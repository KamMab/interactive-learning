"use client";
export default function ConfirmButton({ action, label, message }: { action: () => Promise<void>; label: string; message: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      <button className="btn-danger">{label}</button>
    </form>
  );
}
