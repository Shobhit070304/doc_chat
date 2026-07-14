import { NextRequest, NextResponse } from 'next/server';
import { EmbeddingApiType, GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '@/app/lib/supabase';

const ai = new GoogleGenAI({});
const MAX_QUESTION_LENGTH = 500;

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let delay = 1000;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const isRateLimit = err?.status === 429 || String(err).includes('429');
            if (isRateLimit && attempt < maxRetries - 1) {
                await new Promise((r) => setTimeout(r, delay));
                delay *= 2;
            } else {
                throw err;
            }
        }
    }
    throw new Error('Max retries exceeded');
}

export async function POST(req: NextRequest) {
    try {
        const { question } = await req.json();

        if (!question || typeof question !== 'string' || !question.trim().length) {
            return NextResponse.json({ error: "No question provided" }, { status: 400 });
        }


        const embedResponse = await withRetry(() =>
            ai.models.embedContent({
                model: 'gemini-embedding-001',
                contents: question,
                config: {
                    taskType: 'RETRIEVAL_QUERY',
                    outputDimensionality: 768,
                },
            })
        )

        const queryEmbedding = embedResponse.embeddings![0].values;

        const { data: matches, error } = await supabaseAdmin.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_count: 3,
        })

        if (error) {
            console.error("Error in chat handler", error);
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
        }

        if (!matches || matches.length === 0) {
            return NextResponse.json({
                answer: "I don't have any documents to answer from yet — try ingesting something first.",
                sources: [],
            });
        }

        const context = matches.map((m: any) => m.content).join('\n\n');

        const prompt = `Answer the question using ONLY the context below. If the answer isn't in the context, say you don't know.

        Context:
        ${context}

        Question: ${question}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
        })

        return NextResponse.json({
            answer: response.text,
            sources: matches.map((m: any) => ({ content: m.content, similarity: m.similarity })),
        })

    } catch (error) {
        console.error("Error in chat handler", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}