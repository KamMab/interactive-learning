"use client";
import { useState } from "react";

/** A chapter's description, cut to two lines with a "More" toggle. */
export default function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 160;
  return (
    <div className="mt-2 max-w-[70ch] text-[15px] text-muted">
      <p className={open || !long ? "" : "clamp2"}>{text}</p>
      {long && <button type="button" className="link mt-1" onClick={() => setOpen(!open)}>{open ? "Less" : "More"}</button>}
    </div>
  );
}
