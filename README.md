# DocChat — AI-Powered Document Archive

Paste any document into the archive, then ask it anything. Answers are grounded strictly in your document, and every response shows the exact source chunks it was pulled from.

Built with **Next.js 16**, **Google Gemini**, and **Supabase pgvector**.

---

## How it works

1. **Ingest** — You paste text (up to ~3,000 words / 20,000 characters). It gets split into overlapping 100-word chunks, embedded via `gemini-embedding-001`, and stored in Supabase as 768-dimensional vectors.
2. **Ask** — Your question is embedded the same way, then a cosine-similarity search finds the top 3 matching chunks. Those chunks are passed as context to `gemini-2.0-flash-lite`, which answers using only what's in the document.
3. **Sources** — The UI shows each retrieved chunk alongside its similarity score so you can see exactly where the answer came from.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| AI Embeddings | Google Gemini (`gemini-embedding-001`) |
| AI Generation | Google Gemini (`gemini-2.0-flash-lite`) |
| Vector DB | Supabase with `pgvector` |
| Styling | Tailwind CSS v4 |

---

## Getting Started

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the `pgvector` extension enabled
- A Google AI API key (from [Google AI Studio](https://aistudio.google.com))

### 2. Supabase Setup

Run the following SQL in your Supabase SQL editor:

```sql
-- Enable pgvector
create extension if not exists vector;

-- Documents table
create table documents (
  id bigserial primary key,
  content text not null,
  embedding vector(768)
);

-- Similarity search function
create or replace function match_documents(
  query_embedding vector(768),
  match_count int
)
returns table (content text, similarity float)
language sql stable
as $$
  select content, 1 - (embedding <=> query_embedding) as similarity
  from documents
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### 3. Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_google_ai_api_key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Limits

| Constraint | Value |
|---|---|
| Max document length | 20,000 characters (~3,000 words) |
| Max question length | 500 characters |
| Chunks retrieved per query | 3 |
| Chunk size | 100 words with 20-word overlap |
| Embedding dimensions | 768 |

---

## Project Structure

```
src/
└── app/
    ├── api/
    │   ├── ingest/route.ts   # Chunks, embeds, and stores documents
    │   └── chat/route.ts     # Embeds query, retrieves chunks, generates answer
    ├── lib/
    │   └── supabase.ts       # Supabase admin client
    ├── page.tsx              # Main UI (archive panel + chat panel)
    └── layout.tsx            # Root layout and metadata
```
