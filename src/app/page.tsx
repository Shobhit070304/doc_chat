'use client';

import { useState, useRef, useEffect } from 'react';
import { Fraunces, JetBrains_Mono, Inter } from 'next/font/google';

const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

type Source = { content: string; similarity: number };
type Message = { role: 'user' | 'assistant'; content: string; sources?: Source[] };

export default function Home() {
  const [docText, setDocText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestNote, setIngestNote] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleIngest() {
    if (!docText.trim()) return;
    setIngesting(true);
    setIngestNote(null);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: docText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ingestion failed');
      setIngestNote(`Filed ${data.chunksStored} card${data.chunksStored === 1 ? '' : 's'} into the archive.`);
      setDocText('');
    } catch {
      setIngestNote("Couldn't file that — check your connection and try again.");
    } finally {
      setIngesting(false);
    }
  }

  async function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setQuestion('');
    setAsking(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Couldn't reach the archive. Check your connection and try again." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <main
      className={`${fraunces.variable} ${mono.variable} ${inter.variable} min-h-screen bg-[#1B2430] font-[family-name:var(--font-body)] text-[#EDE6D6]`}
    >
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10">
          <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.25em] text-[#B8934A]">
            AI-Powered Document Archive
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold text-[#F5F1E6] md:text-5xl">
            DocChat
          </h1>
          <p className="mt-2 max-w-lg text-sm text-[#C9C2AE]">
            File a document into the archive, then ask it anything. Every answer comes with the cards it was pulled from.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Archive panel */}
          <section className="rounded-lg border border-[#3A4453] bg-[#212B3B] p-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-medium text-[#F5F1E6]">
              The Archive
            </h2>
            <p className="mt-1 text-xs text-[#8B92A3]">Paste in a document to file it as searchable cards.</p>

            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste your notes, docs, or article text here…"
              rows={10}
              disabled={ingesting}
              className="mt-4 w-full resize-none rounded-md border border-[#3A4453] bg-[#1B2430] p-3 text-sm text-[#EDE6D6] placeholder:text-[#5C6577] focus:border-[#B8934A] focus:outline-none focus:ring-1 focus:ring-[#B8934A]"
            />

            <button
              onClick={handleIngest}
              disabled={ingesting || !docText.trim()}
              className="mt-3 w-full rounded-md bg-[#B8934A] px-4 py-2 text-sm font-medium text-[#1B2430] transition hover:bg-[#CBA662] disabled:cursor-not-allowed disabled:bg-[#5C6577] disabled:text-[#8B92A3]"
            >
              {ingesting ? 'Filing…' : 'Add to archive'}
            </button>

            {ingestNote && <p className="mt-3 text-xs text-[#C9C2AE]">{ingestNote}</p>}
          </section>

          {/* Reading room / chat panel */}
          <section className="flex min-h-[560px] flex-col rounded-lg border border-[#3A4453] bg-[#212B3B]">
            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-5">
              {messages.length === 0 && (
                <p className="text-sm text-[#8B92A3]">
                  Nothing asked yet. Add something to the archive, then ask it anything.
                </p>
              )}

              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[80%] rounded-lg bg-[#B8934A] px-4 py-2 text-sm text-[#1B2430]'
                        : 'max-w-[85%] text-sm text-[#EDE6D6]'
                    }
                  >
                    <p>{m.content}</p>

                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.sources.map((s, si) => (
                          <div
                            key={si}
                            style={{ transform: `rotate(${si % 2 === 0 ? -2 : 2}deg)` }}
                            className="max-w-[220px] rounded border border-[#8B4A3D]/40 bg-[#EDE6D6] px-3 py-2 text-[#2A2721] shadow-md"
                          >
                            <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[#8B4A3D]">
                              {Math.round(s.similarity * 100)}% match
                            </p>
                            <p className="mt-1 line-clamp-3 text-xs leading-snug">{s.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {asking && <p className="text-xs text-[#8B92A3]">Pulling cards from the archive…</p>}
            </div>

            <div className="flex gap-2 border-t border-[#3A4453] p-4">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                placeholder="Ask the archive something…"
                disabled={asking}
                className="flex-1 rounded-md border border-[#3A4453] bg-[#1B2430] px-3 py-2 text-sm text-[#EDE6D6] placeholder:text-[#5C6577] focus:border-[#B8934A] focus:outline-none focus:ring-1 focus:ring-[#B8934A]"
              />
              <button
                onClick={handleAsk}
                disabled={asking || !question.trim()}
                className="rounded-md bg-[#B8934A] px-4 py-2 text-sm font-medium text-[#1B2430] transition hover:bg-[#CBA662] disabled:cursor-not-allowed disabled:bg-[#5C6577] disabled:text-[#8B92A3]"
              >
                Ask
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}