"use client";
import { useEffect, useState } from "react";

// Pictures on cards and questions. An image is either a normal https URL or "wiki:<Wikipedia page>",
// which shows that page's main photo (used for presidents' portraits).
const cache = new Map<string, Promise<string | null>>();

function resolve(src: string): Promise<string | null> {
  if (!src.startsWith("wiki:")) return Promise.resolve(src);
  if (!cache.has(src)) {
    const page = encodeURIComponent(src.slice(5).trim().replace(/ /g, "_"));
    // Wikipedia's page summary first; if that's unavailable, its query API (both allow use from any site).
    const summary = () => fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`)
      .then((r) => (r.ok ? r.json() : null)).then((d) => d?.thumbnail?.source ?? d?.originalimage?.source ?? null).catch(() => null);
    const query = () => fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=400&redirects=1&origin=*&titles=${page}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const pg = d?.query?.pages && Object.values(d.query.pages)[0] as { thumbnail?: { source?: string } } | undefined; return pg?.thumbnail?.source ?? null; })
      .catch(() => null);
    cache.set(src, summary().then((u) => u ?? query()));
  }
  return cache.get(src)!;
}

export default function Pic({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null | undefined>(src.startsWith("wiki:") ? undefined : src);
  const [broken, setBroken] = useState(false);
  useEffect(() => { let on = true; setBroken(false); resolve(src).then((u) => on && setUrl(u)); return () => { on = false; }; }, [src]);
  if (url === undefined) return <span className={`pic pic-wait ${className}`} aria-label="Loading picture" />;
  if (!url || broken) return <span className={`pic pic-missing ${className}`}>Picture unavailable</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={`pic ${className}`} onError={() => setBroken(true)} draggable={false} />;
}
