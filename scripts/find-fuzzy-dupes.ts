import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Club {
  id: string;
  name: string;
  logo_url: string | null;
  status: string | null;
  city: string | null;
  state: string | null;
  coach_count: number | null;
}

// Suffixes to strip, ordered longest-first so "soccer club" is removed before "club"
const SUFFIXES_TO_REMOVE = [
  "youth soccer",
  "football club",
  "soccer club",
  "futbol club",
  "soccer",
  "futbol",
  "football",
  "sc",
  "fc",
  "club",
];

function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();

  // Remove special characters except spaces and alphanumeric
  n = n.replace(/[^a-z0-9\s]/g, " ");

  // Repeatedly strip known suffixes from the end
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of SUFFIXES_TO_REMOVE) {
      if (n.endsWith(" " + suffix) || n === suffix) {
        n = n === suffix ? "" : n.slice(0, n.length - suffix.length - 1);
        n = n.trim();
        changed = true;
        break;
      }
    }
  }

  // Collapse whitespace
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

function pickKeeper(group: Club[]): Club {
  // Sort: has logo_url first, then higher coach_count, then "approved" status
  const sorted = [...group].sort((a, b) => {
    const aLogo = a.logo_url ? 1 : 0;
    const bLogo = b.logo_url ? 1 : 0;
    if (bLogo !== aLogo) return bLogo - aLogo;

    const aCount = a.coach_count ?? 0;
    const bCount = b.coach_count ?? 0;
    if (bCount !== aCount) return bCount - aCount;

    const aApproved = a.status === "approved" ? 1 : 0;
    const bApproved = b.status === "approved" ? 1 : 0;
    return bApproved - aApproved;
  });
  return sorted[0];
}

async function fetchAllClubs(): Promise<Club[]> {
  const all: Club[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("clubs")
      .select("id, name, logo_url, status, city, state, coach_count")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Error fetching clubs:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function main() {
  const clubs = await fetchAllClubs();
  console.log(`Total clubs fetched: ${clubs.length}\n`);

  if (clubs.length === 0) return;

  // Build normalized name map
  const normMap = new Map<string, string>(); // club.id -> normalized name
  const normToClubs = new Map<string, Club[]>(); // normalized -> clubs

  for (const club of clubs) {
    const norm = normalizeName(club.name || "");
    normMap.set(club.id, norm);
    if (!normToClubs.has(norm)) normToClubs.set(norm, []);
    normToClubs.get(norm)!.push(club);
  }

  // Phase 1: exact normalized matches (groups of 2+)
  // Use a union-find to merge groups
  const parent = new Map<string, string>(); // club.id -> root id
  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  // Merge clubs with same normalized name
  for (const [, group] of normToClubs) {
    if (group.length > 1) {
      for (let i = 1; i < group.length; i++) {
        union(group[0].id, group[i].id);
      }
    }
  }

  // Phase 2: substring matching on normalized names
  // For each pair of distinct normalized names, check if one is a substring of the other
  const normNames = [...new Set([...normMap.values()].filter((n) => n.length > 0))];
  normNames.sort((a, b) => a.length - b.length);

  for (let i = 0; i < normNames.length; i++) {
    for (let j = i + 1; j < normNames.length; j++) {
      const shorter = normNames[i];
      const longer = normNames[j];
      // Only match if shorter is a meaningful substring (at least 3 chars)
      if (shorter.length >= 3 && longer.includes(shorter)) {
        const clubsA = normToClubs.get(shorter)!;
        const clubsB = normToClubs.get(longer)!;
        // Union all clubs from both groups
        for (const ca of clubsA) {
          for (const cb of clubsB) {
            union(ca.id, cb.id);
          }
        }
      }
    }
  }

  // Build final groups
  const clubById = new Map<string, Club>();
  for (const c of clubs) clubById.set(c.id, c);

  const groups = new Map<string, Club[]>();
  for (const club of clubs) {
    const root = find(club.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(club);
  }

  // Filter to only groups with 2+ clubs
  const dupeGroups = [...groups.values()].filter((g) => g.length > 1);

  if (dupeGroups.length === 0) {
    console.log("No fuzzy duplicate clubs found.");
    return;
  }

  // Sort groups by size descending
  dupeGroups.sort((a, b) => b.length - a.length);

  console.log(`Found ${dupeGroups.length} fuzzy duplicate group(s):\n`);

  const allIdsToDelete: string[] = [];

  for (let gi = 0; gi < dupeGroups.length; gi++) {
    const group = dupeGroups[gi];
    const keeper = pickKeeper(group);

    // Collect unique names for display
    const names = [...new Set(group.map((c) => c.name))];
    console.log(`=== Group ${gi + 1}: ${names.join(" / ")} (${group.length} entries) ===`);

    for (const club of group) {
      const isKeep = club.id === keeper.id;
      const logo = club.logo_url ? "HAS LOGO" : "no logo";
      const tag = isKeep ? " <<< KEEP" : " <<< DELETE";
      console.log(
        `  id: ${club.id} | name: "${club.name}" | city: ${club.city ?? "—"} | state: ${club.state ?? "—"} | status: ${club.status ?? "—"} | coaches: ${club.coach_count ?? 0} | ${logo}${tag}`
      );
      if (!isKeep) {
        allIdsToDelete.push(club.id);
      }
    }
    console.log();
  }

  console.log("========================================");
  console.log(`SUMMARY`);
  console.log(`  Total duplicate groups: ${dupeGroups.length}`);
  console.log(`  Total clubs to keep:    ${dupeGroups.length}`);
  console.log(`  Total clubs to delete:  ${allIdsToDelete.length}`);
  console.log("========================================\n");

  console.log("IDs to DELETE:");
  console.log(JSON.stringify(allIdsToDelete, null, 2));
}

main();
