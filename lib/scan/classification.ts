export type LeadTier = "hot" | "warm" | "cold";

export function classifyLead(score: number | null): LeadTier {
  if (score === null) return "cold";
  if (score <= 39) return "hot";
  if (score <= 64) return "warm";
  return "cold";
}
