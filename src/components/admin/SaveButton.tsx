"use client";
import { useFormStatus } from "react-dom";
export default function SaveButton({ children = "Save" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn" disabled={pending}>{pending ? "Saving…" : children}</button>;
}
