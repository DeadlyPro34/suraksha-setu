"use client";

import { FormEvent, useEffect, useState } from "react";
import { sendSupportRequestMessage } from "@/lib/api";
import { FieldOfficerSupportMessage } from "@/lib/types";

export function SupportConversation({ requestId, initialMessages = [] }: { requestId: string; initialMessages?: FieldOfficerSupportMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMessages(initialMessages), [initialMessages]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const saved = await sendSupportRequestMessage(requestId, text);
      setMessages((current) => [...current, saved]);
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  };

  return <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <h5 className="text-sm font-semibold text-slate-800">Support conversation</h5>
    {messages.length ? <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">{messages.map((item) => <article key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold capitalize text-slate-700">{item.author_name} · {item.author_role.replace(/_/g, " ")}</span><time className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{item.message}</p></article>)}</div> : <p className="mt-1 text-sm text-slate-500">No messages yet. Use this thread to coordinate the support request.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <form onSubmit={submit} className="mt-2 flex flex-wrap gap-2"><input aria-label="Message support team" maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message the officer, volunteer, or officials" className="min-w-48 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /><button type="submit" disabled={!draft.trim() || sending} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? "Sending…" : "Send"}</button></form>
  </div>;
}
