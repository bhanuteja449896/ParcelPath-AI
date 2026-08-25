import { DocumentChunkResult } from "../data/repositories/documentsRepo";

export const AUTHORITY_TIERS: Record<string, number> = {
  customer_agreement: 1, // Highest
  current_policy: 2,
  sop: 2,
  product_guide: 3,
  known_issues: 3,
  deprecated_policy: 99, // Unreachable
};

export function formatChunksForLLM(chunks: DocumentChunkResult[]): string {
  if (!chunks || chunks.length === 0) return "No relevant documents found.";

  // 1. Deprecated Firewall: Remove deprecated_policy chunks entirely
  const validChunks = chunks.filter((c) => c.authority !== "deprecated_policy");

  // 2. Sort by authority tier (highest first), then by distance
  validChunks.sort((a, b) => {
    const tierA = AUTHORITY_TIERS[a.authority] ?? 99;
    const tierB = AUTHORITY_TIERS[b.authority] ?? 99;
    if (tierA !== tierB) return tierA - tierB;
    return a.distance - b.distance;
  });

  // 3. Format with tier tagging
  return validChunks.map((chunk, index) => {
    const rank = index + 1;
    return `--- DOCUMENT CHUNK ${rank} ---
[Citation ID: doc_${chunk.chunkId}]
[Title: ${chunk.title}]
[Authority Tier: ${chunk.authority} (Precedence: ${AUTHORITY_TIERS[chunk.authority] ?? "Unknown"})]

${chunk.chunkText}
-----------------------------`;
  }).join("\n\n");
}
