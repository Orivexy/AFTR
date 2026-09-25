import Link from "next/link";

/** "Next page" link for offset-cursor admin lists. */
export function Pager({ nextCursor, params }: { nextCursor: string | null; params: Record<string, string | undefined> }) {
  const hasPrev = Boolean(params.cursor);
  if (!nextCursor && !hasPrev) return null;
  const build = (cursor: string | null) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as Array<[string, string]>);
    if (cursor) sp.set("cursor", cursor);
    else sp.delete("cursor");
    return `?${sp}`;
  };
  return (
    <div className="flex justify-between pt-4 text-sm font-semibold">
      {hasPrev ? <Link href={build(null)} className="text-muted hover:text-fg">← Primera página</Link> : <span />}
      {nextCursor && <Link href={build(nextCursor)} className="text-muted hover:text-fg">Siguiente →</Link>}
    </div>
  );
}
