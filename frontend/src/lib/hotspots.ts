// Turns gold_help_hotspots (one row per H3 cell and request type) into the "Needs help" list:
// plain names, the right thing to do for each kind of problem, neighbouring cells merged into one
// place, ranked by how persistent a spot is rather than raw volume, and spread across the city.
import type { HelpHotspot } from "../types";
import { requestTypeInSentence } from "./cover";
import { distanceTo } from "./geo";

/** cleanup: neighbours can tidy it. walk: log it on a walk and report it (graffiti on City property
 * can't be painted over by volunteers). report: the City has to pick it up. */
export type HotspotAction = "cleanup" | "walk" | "report";

interface Kind {
  label: string;
  action: HotspotAction;
}

const KINDS: Record<string, Kind> = {
  "Loose Litter Clean Up Case": { label: "Litter", action: "cleanup" },
  "Street Cleaning and Debris Pick Up Case": { label: "Street debris", action: "cleanup" },
  "Abandoned Recyclables Case": { label: "Recyclables left out", action: "cleanup" },
  "Graffiti Removal - City Property Case": { label: "Graffiti on City property", action: "walk" },
  "Graffiti Removal - Park Property Case": { label: "Graffiti in a park", action: "walk" },
  // Dumped items need a City pickup, and some may be someone's belongings. Not a volunteer cleanup.
  "Abandoned Non-Recyclables-Small Case": { label: "Dumped items", action: "report" },
};

export function hotspotKind(requestType: string, category?: string): Kind {
  const known = KINDS[requestType];
  if (known) return known;
  return { label: requestTypeInSentence(requestType), action: category === "Graffiti" ? "walk" : "cleanup" };
}

/** One place on the list: a seed cell plus touching cells with the same problem. */
export interface HotspotPlace {
  id: string; // the seed cell's hotspot id, used to start an event
  hotspot: HelpHotspot; // the seed cell (busiest)
  cellIds: string[];
  label: string;
  action: HotspotAction;
  reports: number; // all merged cells
  monthsSeen: number; // most persistent cell, out of the last 12 months
  lastReported: string;
  score: number;
}

// Neighbouring res-9 cells are ~0.35 km apart centre to centre.
const NEIGHBOUR_KM = 0.4;

/** Merge each busiest unmerged cell with the touching cells of the same type (one ring, no chains,
 * so a dense area doesn't collapse into one giant blob). */
export function mergeNeighbours(hotspots: HelpHotspot[]): HotspotPlace[] {
  const byType = new Map<string, HelpHotspot[]>();
  for (const h of hotspots) byType.set(h.request_type, [...(byType.get(h.request_type) ?? []), h]);
  const places: HotspotPlace[] = [];
  for (const cells of byType.values()) {
    const left = [...cells].sort((a, b) => b.times_reported - a.times_reported);
    const used = new Set<string>();
    for (const seed of left) {
      if (used.has(seed.id)) continue;
      used.add(seed.id);
      const group = [seed];
      if (seed.lat !== undefined) {
        for (const other of left) {
          if (used.has(other.id) || other.lat === undefined) continue;
          const km = distanceTo({ lat: seed.lat, lng: seed.lng! }, other);
          if (km !== undefined && km <= NEIGHBOUR_KM) {
            used.add(other.id);
            group.push(other);
          }
        }
      }
      const kind = hotspotKind(seed.request_type, seed.category);
      const reports = group.reduce((n, h) => n + h.times_reported, 0);
      const monthsSeen = Math.min(12, Math.max(...group.map((h) => h.months_seen)));
      const lastReported = group.map((h) => h.last_reported).sort().at(-1)!;
      places.push({
        id: seed.id,
        hotspot: seed,
        cellIds: group.map((h) => h.id),
        label: kind.label,
        action: kind.action,
        reports,
        monthsSeen,
        lastReported,
        score: persistenceScore(monthsSeen, reports, lastReported),
      });
    }
  }
  return places;
}

/**
 * Coming back month after month matters more than one busy stretch: months seen scales the score,
 * report volume only counts logarithmically, and a spot quiet for months fades.
 */
export function persistenceScore(monthsSeen: number, reports: number, lastReported: string, now = Date.now()) {
  const daysQuiet = (now - Date.parse(lastReported)) / 86400000;
  const recency = daysQuiet <= 30 ? 1 : daysQuiet <= 90 ? 0.6 : 0.3;
  return (monthsSeen / 12) * Math.log2(1 + reports) * recency;
}

/** Best place per neighbourhood first (so the top of the list isn't all one area), then the rest.
 * Places volunteers can act on come before report-only ones. */
export function spreadByArea(places: HotspotPlace[]): HotspotPlace[] {
  const sorted = [...places].sort((a, b) => Number(a.action === "report") - Number(b.action === "report") || b.score - a.score);
  const seen = new Set<string>();
  const first: HotspotPlace[] = [], rest: HotspotPlace[] = [];
  for (const p of sorted) {
    if (seen.has(p.hotspot.local_area)) rest.push(p);
    else {
      seen.add(p.hotspot.local_area);
      first.push(p);
    }
  }
  return [...first, ...rest];
}

/** "312 reports · every month this year" */
export function describeReports(reports: number, monthsSeen: number) {
  const when = monthsSeen >= 12 ? "every month this year" : `${monthsSeen} of the last 12 months`;
  return `${reports} ${reports === 1 ? "report" : "reports"} · ${when}`;
}
