import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabaseAdmin } from "@/app/lib/supabase";


const ai = new GoogleGenAI({});
const MAX_DOCUMENT_LENGTH = 20000; // ~3,000 words

function chunkText(text: string, chunkSize = 100, overLap = 20): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
        const end = start + chunkSize
        chunks.push(words.slice(start, end).join(" "));
        start += chunkSize - overLap;
    }
    return chunks;
}

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
        const { text } = await req.json();

        if (!text || text.trim().length === 0 || typeof text !== 'string') {
            return NextResponse.json({ error: "No text provided" }, { status: 400 })
        }

        const chunks = chunkText(text);

        const embedResponse = await withRetry(() =>
            ai.models.embedContent({
                model: 'gemini-embedding-001',
                contents: chunks,
                config: {
                    taskType: 'RETRIEVAL_DOCUMENT', // tells the model these are documents, not queries
                    outputDimensionality: 768,       // must match the vector(768) column in Supabase
                },
            })
        );

        const rows = chunks.map((content, i) => ({
            content,
            embedding: embedResponse.embeddings![i].values,
        }));

        const { error } = await supabaseAdmin.from('documents').insert(rows);

        if (error) {
            console.error("Error upserting:", error);
            return NextResponse.json({ error: "Failed to store document chunks in Supabase" }, { status: 500 })
        }

        return NextResponse.json({ success: true, chunksStored: rows.length })
    }
    catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}