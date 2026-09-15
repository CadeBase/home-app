// Connection details for your Supabase project.
// The publishable key below is safe to expose in browser code —
// it is not a secret (your Supabase Row Level Security policies
// control what it's allowed to do).
export const SUPABASE_URL = "https://mnwsqrkoxktijhfqapmv.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IQTm4DcglyJmWV0MhO7qoA_gzg5SvcM";

// A simple household passcode so casual visitors can't open the app
// if they guess or stumble on the link. This is a light privacy gate,
// not strong security (it lives in the app's code, so it won't stop
// someone determined and technical) — good enough for keeping the
// app off strangers' radar, not for protecting sensitive secrets.
// Change this to whatever you like before sharing the app link.
export const HOUSEHOLD_PASSCODE = "changeme";
