/**
 * PDF Ingestion / RAG Pipeline — T11 (ARCHITECTURE.md SS14-15, TASKS.md T11)
 *
 * Reads 6 supplied PDFs, extracts text, chunks (~500 tokens), embeds with OpenAI,
 * and upserts into `documents` / `document_chunks`.
 * Applies hardcoded authority tiers based on filename mapping.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pdf from "pdf-parse";
import OpenAI from "openai";
import postgres from "postgres";

const ROOT = path.resolve(import.meta.dirname, "..");

// ── Load env ──────────────────────────────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_a-z]+)=(.*)/);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

const env = loadEnv();

if (env.NODE_ENV === "production" && env.ALLOW_RESEED !== "true") {
  console.error("ABORT: NODE_ENV=production and ALLOW_RESEED is not true.");
  process.exit(1);
}

const DIRECT_URL = env.DIRECT_URL;
if (!DIRECT_URL) {
  console.error("FAIL: DIRECT_URL missing from .env");
  process.exit(1);
}

const OPENAI_API_KEY = env.LLM_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("FAIL: LLM_API_KEY missing from .env (needed for embeddings)");
  process.exit(1);
}

const EMBED_MODEL = env.EMBED_MODEL || "text-embedding-3-small";
const EMBED_DIM = 1536;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: env.LLM_BASE_URL });
const sql = postgres(DIRECT_URL, { prepare: false, max: 2 });

// ── Chunking Config (approx 500 tokens ~ 2000 chars) ────────────────────────
const CHUNK_SIZE_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 320; // ~80 tokens overlap

/** Splits text into chunks by characters with overlap */
function chunkText(text: string, maxChars: number, overlapChars: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = i + maxChars;
    // Try to break at a newline or period if possible, but don't look back too far
    if (end < text.length) {
      const window = text.substring(Math.max(i, end - 200), end);
      const lastNewline = window.lastIndexOf("\n");
      const lastPeriod = window.lastIndexOf(". ");
      if (lastNewline > 0) {
        end = end - 200 + lastNewline + 1;
      } else if (lastPeriod > 0) {
        end = end - 200 + lastPeriod + 2;
      }
    }
    const chunk = text.substring(i, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    i = end - overlapChars;
    if (i < 0 || end >= text.length) break;
  }
  return chunks;
}

// ── File Mapping ─────────────────────────────────────────────────────────────
interface DocMapping {
  slug: string;
  tier: "current_policy" | "deprecated_policy" | "sop" | "product_guide" | "known_issues" | "customer_agreement";
  account_code: string | null;
}

const FILE_MAP: Record<string, DocMapping> = {
  "01_Support_Policy_v3_CURRENT.pdf": {
    slug: "support-policy-v3",
    tier: "current_policy",
    account_code: null,
  },
  "02_Support_Policy_v2_DEPRECATED.pdf": {
    slug: "support-policy-v2-deprecated",
    tier: "deprecated_policy",
    account_code: null,
  },
  "03_Cancellation_and_Service_Credit_SOP_v4.pdf": {
    slug: "cancellation-service-credit-sop",
    tier: "sop",
    account_code: null,
  },
  "04_Product_Operations_Guide_and_Known_Issues.pdf": {
    slug: "product-ops-guide",
    tier: "product_guide",
    account_code: null,
  },
  "05_Northstar_Logistics_Enterprise_Agreement.pdf": {
    slug: "northstar-agreement",
    tier: "customer_agreement",
    account_code: "northstar_logistics",
  },
  "06_LumenWorks_Service_Agreement.pdf": {
    slug: "lumenworks-agreement",
    tier: "customer_agreement",
    account_code: "lumenworks",
  },
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dataDir = path.join(ROOT, "data", "raw");
  if (!fs.existsSync(dataDir)) {
    console.error(`FAIL: data/raw directory not found`);
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) {
    console.error("FAIL: No PDFs found in data/raw");
    process.exit(1);
  }

  // Ensure accounts exist for the account limits
  const accountsRows = await sql<{ id: string; code: string }[]>`SELECT id, code FROM accounts`;
  const accountsMap = new Map(accountsRows.map(r => [r.code, r.id]));

  console.log(`Found ${files.length} PDFs for ingestion.`);

  // Write embedding dimension to system metadata
  await sql`
    INSERT INTO system_metadata (key, value)
    VALUES ('embedding_dim', ${JSON.stringify(EMBED_DIM)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  for (const file of files) {
    console.log(`\nProcessing: ${file}`);
    const mapping = FILE_MAP[file];
    if (!mapping) {
      console.error(`  FAIL: Unmapped file ${file}. Aborting.`);
      process.exit(1);
    }

    const filePath = path.join(dataDir, file);
    const rawBuffer = fs.readFileSync(filePath);
    const contentSha256 = crypto.createHash("sha256").update(rawBuffer).digest("hex");

    // Check if already up-to-date
    const existing = await sql<{ content_sha256: string }[]>`
      SELECT content_sha256 FROM documents WHERE slug = ${mapping.slug}
    `;
    if (existing.length > 0 && existing[0]!.content_sha256 === contentSha256) {
      console.log(`  Skip: Document ${mapping.slug} already up-to-date.`);
      continue;
    }

    // Resolve account_id if restricted
    let restrictAccountId = null;
    if (mapping.account_code) {
      restrictAccountId = accountsMap.get(mapping.account_code);
      if (!restrictAccountId) {
        console.error(`  FAIL: Account code ${mapping.account_code} not found in DB.`);
        process.exit(1);
      }
    }

    console.log(`  Extracting text...`);
    const pdfData = await pdf(rawBuffer);
    const text = pdfData.text.replace(/\r\n/g, "\n");

    const chunks = chunkText(text, CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS);
    console.log(`  Created ${chunks.length} chunks. Fetching embeddings...`);

    // Fetch embeddings in batches
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 20) {
      const batch = chunks.slice(i, i + 20);
      const response = await openai.embeddings.create({
        model: EMBED_MODEL,
        input: batch,
      });
      for (const data of response.data) {
        embeddings.push(data.embedding);
      }
    }

    // Upsert into DB transactionally
    await sql.begin(async (tx) => {
      // 1. Delete old document and cascade chunks
      await tx`DELETE FROM documents WHERE slug = ${mapping.slug}`;

      // 2. Insert document
      const docRows = await tx<{ id: string }[]>`
        INSERT INTO documents (
          slug, title, source_filename, content_sha256,
          authority, account_id
        ) VALUES (
          ${mapping.slug}, ${file.replace(".pdf", "").replace(/_/g, " ")}, ${file}, ${contentSha256},
          ${mapping.tier}, ${restrictAccountId}
        )
        RETURNING id
      `;
      const docId = docRows[0]!.id;

      // 3. Insert chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]!;
        // Format vector for pgvector: [1,2,3]
        const embeddingStr = `[${embeddings[i]!.join(",")}]`;
        
        await tx`
          INSERT INTO document_chunks (
            document_id, chunk_index, chunk_text, embedding
          ) VALUES (
            ${docId}, ${i}, ${chunkText}, ${embeddingStr}
          )
        `;
      }
    });

    console.log(`  ✅ Upserted ${mapping.slug} with ${chunks.length} chunks.`);
  }

  console.log("\nPDF Ingestion complete.");
  await sql.end();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
