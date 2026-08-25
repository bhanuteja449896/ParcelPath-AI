import OpenAI from "openai";
import { config } from "@/lib/config";

/**
 * Initializes and exports a singleton OpenAI client.
 */
let openai: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: config.llm.apiKey,
    });
  }
  return openai;
}

export const EMBED_MODEL = config.llm.embedModel || "text-embedding-3-small";
