import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const STORAGE_BUCKET = "portfolio-images";
export const DOCUMENTS_BUCKET = "portfolio-documents";

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getImageUrl(path) {
  if (!path || !supabase) return "";
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

export function getDocumentUrl(path, download = false) {
  if (!path || !supabase) return "";
  const url = new URL(
    supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path).data.publicUrl,
  );
  if (download) {
    url.searchParams.set("download", "CV_Angie_Sohane_Ndaghy_Pambo.pdf");
  }
  return url.href;
}
