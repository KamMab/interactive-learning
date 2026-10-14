import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SideNav from "@/components/SideNav";
import LeaderboardSync from "@/components/LeaderboardSync";
import { isAdmin } from "@/lib/admin-auth";
import { SITE_NAME } from "@/lib/config";
import { STORE_KEY } from "@/lib/store-key";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: "Study games built from real class notes, plus games anyone can make.",
};

// Sets the saved theme before the page paints so dark mode doesn't flash light first.
const themeScript = `try{var s=JSON.parse(localStorage.getItem("${STORE_KEY}")||"{}");if(s.settings&&s.settings.theme==="dark")document.documentElement.classList.add("lr-dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <SiteHeader siteName={SITE_NAME} isAdmin={await isAdmin()} />
        <div className="shell">
          <SideNav />
          <div className="shell-main">
            <main className="wrap">{children}</main>
            <p className="foot">
              Built around UCLA courses. Not affiliated with or endorsed by UCLA. · <Link href="/admin/login" className="underline">Admin login</Link>
            </p>
          </div>
        </div>
        <LeaderboardSync />
      </body>
    </html>
  );
}
