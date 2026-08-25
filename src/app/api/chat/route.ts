import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/data/client";
import { runAgentLoop, ChatMessage } from "@/lib/agent/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const ctxResult = await requireSession(req, db);
    
    if (ctxResult instanceof NextResponse) {
      return ctxResult; // Returns 401 if unauthorized
    }
    
    const ctx = ctxResult;
    
    // In v1, the client sends the conversation history
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({ error: "No messages provided." }, { status: 400 });
    }

    // Run the agent loop, which returns a ReadableStream emitting SSE events
    const stream = await runAgentLoop(ctx, messages);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
