import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Nuestro rastreador" };

const BOT = `${site.name.replace(/[^a-z0-9]/gi, "")}Bot`;

/** Linked from the crawler's User-Agent so site owners know who is visiting. */
export default function BotPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 pt-6 pb-16 text-[15px] leading-relaxed md:pt-10">
      <h1 className="font-display text-3xl font-bold">{BOT}</h1>
      <p>
        {BOT} es el rastreador de {site.name}. Lee únicamente las agendas públicas de eventos (iCal, schema.org) de las webs que los administradores de {site.name} han añadido como fuente.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>Respeta <code>robots.txt</code> (agente <code>{BOT.toLowerCase()}</code>).</li>
        <li>Hace como máximo una petición por servidor cada 1,5 segundos.</li>
        <li>No accede a zonas privadas ni envía formularios.</li>
        <li>Guarda el enlace a la fuente original de cada evento.</li>
      </ul>
      <p className="text-muted">
        Para bloquearlo añade a tu <code>robots.txt</code>: <code>User-agent: {BOT.toLowerCase()}</code> seguido de <code>Disallow: /</code>.
      </p>
    </article>
  );
}
