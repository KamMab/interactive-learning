export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Interactive Learning";

// Flip NEXT_PUBLIC_ENABLE_AUTH to "true" once Google sign-in is configured in Supabase.
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const hasSupabase = () => Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);


// How many notes uploads (each one is a Claude call you pay for) one student can make per day.
export const UPLOADS_PER_DAY = Number(process.env.UPLOADS_PER_DAY || 5);
