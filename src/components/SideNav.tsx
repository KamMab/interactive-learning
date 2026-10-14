"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ICON } from "./icons";

export const NAV = [
  { href: "/", label: "Home", short: "Home", icon: ICON.home },
  { href: "/library", label: "Library", short: "Library", icon: ICON.library },
  { href: "/games", label: "Games", short: "Games", icon: ICON.game },
  { href: "/mine", label: "Your chapters", short: "Yours", icon: ICON.folder },
  { href: "/progress", label: "Progress", short: "Progress", icon: ICON.progress },
  { href: "/awards", label: "Awards", short: "Awards", icon: ICON.award },
  { href: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: ICON.podium },
];

// Left-hand menu on wide screens; a tab bar along the bottom on phones.
export default function SideNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href)) || (href === "/library" && path.startsWith("/courses"));
  return (
    <nav className="side" aria-label="Main">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
          {n.icon}<span className="nl">{n.label}</span><span className="ns">{n.short}</span>
        </Link>
      ))}
    </nav>
  );
}
