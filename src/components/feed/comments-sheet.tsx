"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, Loader2, Send, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { useSession } from "@/components/providers/session-provider";
import { useRequireAuth } from "@/components/providers/auth-gate";
import { useToast } from "@/components/providers/toast-provider";
import { useReport } from "@/components/social/report-dialog";
import { api, ApiClientError, reviveDates } from "@/lib/api-client";
import { timeAgo } from "@/lib/time";
import type { CommentData, Page } from "@/lib/types";

export function CommentsSheet({ postId, open, onClose, onCountChange }: { postId: string; open: boolean; onClose: () => void; onCountChange: (delta: number) => void }) {
  const [page, setPage] = useState<Page<CommentData> | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const user = useSession();
  const requireAuth = useRequireAuth();
  const toast = useToast();
  const report = useReport();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPage(null);
    api
      .get<Page<CommentData>>(`/api/posts/${postId}/comments`)
      .then((p) => !cancelled && setPage(reviveDates(p)))
      .catch(() => !cancelled && setPage({ items: [], nextCursor: null }));
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  const loadMore = async () => {
    if (!page?.nextCursor) return;
    const next = reviveDates(await api.get<Page<CommentData>>(`/api/posts/${postId}/comments?cursor=${page.nextCursor}`));
    setPage({ items: [...page.items, ...next.items], nextCursor: next.nextCursor });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !requireAuth("Inicia sesión para comentar")) return;
    setSending(true);
    try {
      const { comment } = reviveDates(await api.post<{ comment: CommentData }>(`/api/posts/${postId}/comments`, { body }));
      setPage((p) => ({ items: [...(p?.items ?? []), comment], nextCursor: p?.nextCursor ?? null }));
      setBody("");
      onCountChange(1);
    } catch (err) {
      toast((err as ApiClientError).message, "error");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.del(`/api/comments/${id}`);
      setPage((p) => p && { ...p, items: p.items.filter((c) => c.id !== id) });
      onCountChange(-1);
    } catch (err) {
      toast((err as ApiClientError).message, "error");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Comentarios" tall>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4 pb-4">
          {!page && (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted" />
            </div>
          )}
          {page && !page.items.length && <p className="py-10 text-center text-sm text-muted">Aún no hay comentarios. ¡Rompe el hielo!</p>}
          {page?.items.map((c) => (
            <div key={c.id} className="group flex gap-3">
              <Link href={`/u/${c.author.username}`}>
                <Avatar user={c.author} size={34} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-[13px]">
                  <Link href={`/u/${c.author.username}`} className="font-semibold">
                    {c.author.username}
                  </Link>{" "}
                  <span className="text-faint">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="text-[15px] break-words whitespace-pre-line">{c.body}</p>
              </div>
              <div className="flex items-start gap-1 opacity-60 group-hover:opacity-100">
                {c.canDelete ? (
                  <button onClick={() => remove(c.id)} aria-label="Eliminar comentario" className="grid size-8 place-items-center rounded-full hover:bg-surface-2">
                    <Trash2 className="size-4" />
                  </button>
                ) : (
                  <button onClick={() => report.open("COMMENT", c.id)} aria-label="Reportar comentario" className="grid size-8 place-items-center rounded-full hover:bg-surface-2">
                    <Flag className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {page?.nextCursor && (
            <button onClick={loadMore} className="w-full py-2 text-sm font-semibold text-muted">
              Ver más comentarios
            </button>
          )}
        </div>
        <form onSubmit={send} className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-line bg-surface px-5 pt-3">
          {user && <Avatar user={user} size={34} />}
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => requireAuth("Inicia sesión para comentar")}
            maxLength={500}
            placeholder="Añade un comentario…"
            aria-label="Comentario"
            className="h-11 flex-1 rounded-full border border-line-strong bg-surface-2 px-4 text-[15px] outline-none focus:border-volt/60"
          />
          <button type="submit" disabled={!body.trim() || sending} aria-label="Enviar" className="pressable grid size-11 place-items-center rounded-full bg-volt text-on-volt disabled:opacity-40">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
      {report.dialog}
    </Sheet>
  );
}
