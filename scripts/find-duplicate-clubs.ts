import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Fetch all clubs
  const { data: clubs, error } = await supabase
    .from("clubs")
    .select("id, name, logo_url, status, coach_count");

  if (error) {
    console.error("Error fetching clubs:", error.message);
    process.exit(1);
  }

  if (!clubs || clubs.length === 0) {
    console.log("No clubs found.");
    return;
  }

  console.log(`Total clubs fetched: ${clubs.length}\n`);

  // Group by lowercase name
  const groups = new Map<string, typeof clubs>();
  for (const club of clubs) {
    const key = (club.name || "").toLowerCase().trim();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(club);
  }

  // Find duplicates
  const duplicateGroups: [string, typeof clubs][] = [];
  for (const [key, group] of groups) {
    if (group.length > 1) {
      duplicateGroups.push([key, group]);
    }
  }

  if (duplicateGroups.length === 0) {
    console.log("No duplicate clubs found.");
    return;
  }

  console.log(`Found ${duplicateGroups.length} duplicate group(s):\n`);

  const idsToDelete: string[] = [];

  for (const [name, group] of duplicateGroups) {
    console.log(`--- "${name}" (${group.length} entries) ---`);

    // Sort: clubs with logos first, then by coach_count descending
    const sorted = [...group].sort((a, b) => {
      const aHasLogo = a.logo_url ? 1 : 0;
      const bHasLogo = b.logo_url ? 1 : 0;
      if (bHasLogo !== aHasLogo) return bHasLogo - aHasLogo;
      return (b.coach_count || 0) - (a.coach_count || 0);
    });

    const keepId = sorted[0].id;

    for (const club of sorted) {
      const isKeep = club.id === keepId;
      const logo = club.logo_url ? "HAS LOGO" : "NO LOGO";
      const tag = isKeep ? " <-- KEEP" : " <-- DELETE";
      console.log(
        `  id: ${club.id} | status: ${club.status} | coach_count: ${club.coach_count ?? 0} | ${logo}${tag}`
      );
      if (!isKeep) {
        idsToDelete.push(club.id);
      }
    }
    console.log();
  }

  console.log("=== IDs to DELETE ===");
  console.log(JSON.stringify(idsToDelete, null, 2));
}

main();
