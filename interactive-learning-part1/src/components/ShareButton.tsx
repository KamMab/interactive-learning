"use client";
import { useEffect, useRef, useState } from "react";

// Share a chapter, game or course: the phone/Mac share sheet when there is one (Messages, AirDrop, WhatsApp…),
// plus direct links for Messages, email, WhatsApp, X and Facebook, and Copy link.
export default function ShareButton({ title, text, path, isPrivate }: { title: string; text?: string; path?: string; isPrivate?: boolean }) {
  const [open, setOpen] = useState(false), [copied, setCopied] = useState(false), [canSheet, setCanSheet] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const url = () => (typeof location === "undefined" ? "" : new URL(path ?? location.pathname, location.origin).toString());
  const msg = text ?? `Study "${title}" with me on Interactive Learning`;

  useEffect(() => { setCanSheet(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("mousedown", close); addEventListener("keydown", esc);
    return () => { removeEventListener("mousedown", close); removeEventListener("keydown", esc); };
  }, [open]);

  async function copy() {
    try { await navigator.clipboard.writeText(url()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { prompt("Copy this link:", url()); }
  }
  async function sheet() {
    try { await navigator.share({ title, text: msg, url: url() }); setOpen(false); } catch { /* cancelled */ }
  }
  const enc = encodeURIComponent;
  const links = () => [
    { name: "Messages", href: `sms:&body=${enc(`${msg}: ${url()}`)}` },
    { name: "Email", href: `mailto:?subject=${enc(title)}&body=${enc(`${msg}:\n\n${url()}`)}` },
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(`${msg}: ${url()}`)}` },
    { name: "X", href: `https://x.com/intent/post?text=${enc(msg)}&url=${enc(url())}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url())}` },
  ];

  return (
    <div className="share" ref={box}>
      <button type="button" className="btn-ghost" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        Share
      </button>
      {open && (
        <div className="share-menu" role="menu">
          {isPrivate && <p className="share-note">This is set to <b>Just me</b>, so friends can&apos;t open it until you share it with everyone.</p>}
          {canSheet && <button type="button" role="menuitem" className="share-item primary" onClick={sheet}>Share…<span>AirDrop, Messages, more</span></button>}
          <button type="button" role="menuitem" className="share-item" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
          {links().map((l) => (
            <a key={l.name} role="menuitem" className="share-item" href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" onClick={() => setOpen(false)}>{l.name}</a>
          ))}
        </div>
      )}
    </div>
  );
}
