"use client";
import { useActionState } from "react";
import { login } from "../actions";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card mx-auto mt-10 max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <label className="label mt-4" htmlFor="pw">Password</label>
      <input id="pw" name="password" type="password" className="input" autoFocus required />
      {state?.error && <p className="mt-2 text-sm text-bad">{state.error}</p>}
      <button className="btn mt-4 w-full" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
    </form>
  );
}
