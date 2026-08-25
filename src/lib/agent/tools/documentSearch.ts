import { z } from "zod";
import { AgentContext } from "@/lib/types";
import { documentsRepo } from "@/lib/data/repositories/documentsRepo";
import { getLLMClient, EMBED_MODEL } from "@/lib/llm/client";
import { formatChunksForLLM } from "../trust";

export const documentSearchSchema = z.object({
  query: z.string().describe("The search query. Should be a full sentence describing the issue or question."),
  topicHint: z.string().optional().describe("Optional topic hint (e.g. 'cancellation', 'SLA') to aid logging/filtering."),
});

export type DocumentSearchArgs = z.infer<typeof documentSearchSchema>;

export async function documentSearch(ctx: AgentContext, args: DocumentSearchArgs): Promise<string> {
  const llm = getLLMClient();
  
  // Get embeddings for the query
  const embedRes = await llm.embeddings.create({
    model: EMBED_MODEL,
    input: args.query,
  });
  
  const queryEmbedding = embedRes.data[0].embedding;
  
  // Search chunks using pgvector (hybrid search logic is in the repo)
  // RLS ensures the caller only sees documents they are allowed to see.
  const chunks = await documentsRepo.searchChunksHybrid(ctx, queryEmbedding, { limit: 6, minSimilarity: 0.2 });
  
  // Apply trust formatting (e.g., stripping out deprecated, adding tier tags)
  return formatChunksForLLM(chunks);
}
