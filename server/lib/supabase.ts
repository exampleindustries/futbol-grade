// server/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import type { Request, Response } from "express";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

export function getSupabaseClient(authHeader?: string) {
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    return createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function requireAdmin(
  req: Request,
  res: Response
): Promise<ReturnType<typeof getSupabaseClient> | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const supabase = getSupabaseClient(authHeader);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return supabase;
}

export async function logAudit(
  supabase: ReturnType<typeof getSupabaseClient>,
  action: string,
  entityType: string,
  entityIds: string[],
  details?: Record<string, any>
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("admin_audit_log").insert({
      admin_id: user?.id || null,
      admin_email: user?.email || null,
      action,
      entity_type: entityType,
      entity_ids: entityIds,
      entity_count: entityIds.length,
      details: details || {},
    });
  } catch (err) {
    console.error("[AUDIT] Failed to log:", err);
  }
}
