// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

// import all entrypoints
import "../../entrypoints.js";

// Import a few things we'll use to test the exports
import { LLMChain } from "langchain/chains";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
} from "langchain/prompts";
import { OpenAI } from "langchain/llms/openai";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { CallbackManager } from "langchain/callbacks";

import { NextRequest, NextResponse } from "next/server";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest) {
  // Intantiate a few things to test the exports
  new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY });
  const emb = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  // Set up a streaming LLM
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const llm = new ChatOpenAI({
    streaming: true,
    callbackManager: CallbackManager.fromHandlers({
      handleLLMNewToken: async (token) => {
        await writer.ready;
        await writer.write(encoder.encode(`data: ${token}\n\n`));
      },
      handleLLMEnd: async () => {
        await writer.ready;
        await writer.close();
      },
      handleLLMError: async (e) => {
        await writer.ready;
        await writer.abort(e);
      },
    }),
  });

  // Test a chain + prompt + model
  const chain = new LLMChain({
    llm,
    prompt: ChatPromptTemplate.fromPromptMessages([
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]),
  });

  // Run the chain but don't await it
  chain.run("hello").catch(console.error);

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
