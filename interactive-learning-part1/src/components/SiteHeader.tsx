"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import AuthButton from "./AuthButton";
import SearchBar from "./SearchBar";
import SettingsDialog from "./SettingsDialog";
import { ICON } from "./icons";
import { applyTheme, startStudyClock } from "@/lib/store";

/** Anything can open Settings with: window.dispatchEvent(new Event("open-settings")) */
export const openSettings = () => window.dispatchEvent(new Event("open-settings"));

export default function SiteHeader({ siteName, isAdmin }: { siteName: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    applyTheme();
    startStudyClock();
    const fn = () => setOpen(true);
    addEventListener("open-settings", fn);
    return () => removeEventListener("open-settings", fn);
  }, []);
  return (
    <>
      <header className="cover">
        <div className="cover-in">
          <Link href="/" className="brand" aria-label={`${siteName} library`}>{ICON.book}{siteName}</Link>
          <SearchBar />
          <div className="cover-right">
            <Link href="/upload" className="gear upload">{ICON.upload}<span className="gl">Upload</span></Link>
            {isAdmin && <Link href="/admin" className="gear">{ICON.admin}<span className="gl">Admin</span></Link>}
            <button className="gear" onClick={() => setOpen(true)} aria-label="Settings">{ICON.gear}<span className="gl">Settings</span></button>
            <AuthButton />
          </div>
        </div>
      </header>
      {open && <SettingsDialog onClose={() => setOpen(false)} />}
    </>
  );
}
