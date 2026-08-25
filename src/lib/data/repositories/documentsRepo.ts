import { AgentContext } from "@/lib/types";
import { withUserContext } from "../withUserContext";

export interface DocumentChunkResult {
  chunkId: string;
  documentId: string;
  slug: string;
  title: string;
  authority: string;
  chunkText: string;
  distance: number;
}

export const documentsRepo = {
  /**
   * Performs a hybrid search (vector cosine distance + optional FTS) across chunks.
   * RLS automatically filters out deprecated documents and correctly scopes 
   * account-restricted agreements based on the AgentContext.
   */
  async searchChunksHybrid(
    ctx: AgentContext, 
    queryEmbedding: number[], 
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<DocumentChunkResult[]> {
    const limit = options.limit ?? 5;
    
    // In pgvector, `<=>` is cosine distance. 
    // Cosine similarity = 1 - cosine distance.
    // So distance <= 1 - minSimilarity
    const maxDistance = options.minSimilarity !== undefined 
      ? 1 - options.minSimilarity 
      : 0.5;

    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT 
          c.id AS "chunkId",
          d.id AS "documentId",
          d.slug,
          d.title,
          d.authority,
          c.chunk_text AS "chunkText",
          (c.embedding <=> ${embeddingStr}) AS distance
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE (c.embedding <=> ${embeddingStr}) <= ${maxDistance}
        ORDER BY distance ASC
        LIMIT ${limit}
      `;
      return rows as DocumentChunkResult[];
    });
  },

  /**
   * Gets metadata for a specific document. 
   * RLS automatically enforces visibility.
   */
  async getDocMeta(ctx: AgentContext, slug: string): Promise<any | null> {
    return await withUserContext(ctx, async (tx) => {
      const rows = await tx<any[]>`
        SELECT 
          id, slug, title, authority, source_filename AS "sourceFilename", 
          page_count AS "pageCount", ingested_at AS "ingestedAt"
        FROM documents
        WHERE slug = ${slug}
      `;
      return rows.length ? rows[0] : null;
    });
  }
};
