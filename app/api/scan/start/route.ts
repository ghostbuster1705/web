import { NextResponse } from "next/server";

import { getOptionalEnv } from "@/lib/env";
import { auditBusinessSite, type LeadAuditResult, searchPlaces } from "@/lib/scan/audit";

const MAX_PLACES = 60;
const BAD_LEAD_MAX_SCORE = 64;
const MAX_RETURNED_LEADS = 30;
const MIN_TARGET_LEADS = 12;
const AUDIT_CONCURRENCY = 6;

type StartScanRequest = {
  niche?: string;
  city?: string;
  criteria?: string[];
};

function normalizePayload(payload: StartScanRequest) {
  return {
    niche: payload.niche?.trim() ?? "",
    city: payload.city?.trim() ?? "",
    criteria: Array.isArray(payload.criteria) ? payload.criteria : [],
  };
}

function leadTier(score: number) {
  if (score <= 39) return "hot";
  if (score <= 64) return "warm";
  return "cold";
}

function responseWithLeads(params: {
  niche: string;
  city: string;
  leads: LeadAuditResult[];
  message?: string;
}) {
  const { niche, city, leads, message } = params;

  return NextResponse.json({
    scan_id: null,
    niche,
    city,
    leads_count: leads.length,
    leads: leads.map((lead) => ({
      ...lead,
      tier: leadTier(lead.score),
    })),
    mode: "public",
    ...(message ? { message } : {}),
  });
}

function rankLeads(leads: LeadAuditResult[]) {
  return [...leads].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.issues.length - a.issues.length;
  });
}

async function auditBusinesses(
  businesses: Awaited<ReturnType<typeof searchPlaces>>,
  criteria: string[],
) {
  const queue = businesses.filter((business) => Boolean(business.website));
  const auditedLeads: LeadAuditResult[] = [];

  for (let i = 0; i < queue.length; i += AUDIT_CONCURRENCY) {
    const batch = queue.slice(i, i + AUDIT_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((business) =>
        auditBusinessSite({
          businessName: business.name,
          websiteUrl: business.website ?? "",
          phone: business.formatted_phone_number,
          address: business.formatted_address,
          placeId: business.place_id,
          criteria,
        }),
      ),
    );
    auditedLeads.push(...batchResults);
  }

  return auditedLeads;
}

export async function POST(request: Request) {
  const body = (await request.json()) as StartScanRequest;
  const { niche, city, criteria } = normalizePayload(body);

  if (!niche || !city) {
    return NextResponse.json(
      { error: "niche and city are required" },
      { status: 400 },
    );
  }

  try {
    const placesApiKey = getOptionalEnv("GOOGLE_PLACES_API_KEY");
    const businesses = await searchPlaces({
      niche,
      city,
      maxResults: MAX_PLACES,
      apiKey: placesApiKey,
    });

    if (businesses.length === 0) {
      return responseWithLeads({
        niche,
        city,
        leads: [],
        message: "No businesses found, try a broader niche or different city",
      });
    }

    const auditedLeads = await auditBusinesses(businesses, criteria);
    const rankedLeads = rankLeads(auditedLeads);
    const badLeads = rankedLeads.filter((lead) => lead.score <= BAD_LEAD_MAX_SCORE);

    const selectedLeads =
      badLeads.length >= MIN_TARGET_LEADS
        ? badLeads.slice(0, MAX_RETURNED_LEADS)
        : rankedLeads.slice(0, MAX_RETURNED_LEADS);

    if (selectedLeads.length === 0) {
      return responseWithLeads({
        niche,
        city,
        leads: [],
        message:
          "No websites could be analyzed for this search. Try another niche or nearby city.",
      });
    }

    const fallbackMessage =
      badLeads.length < MIN_TARGET_LEADS
        ? "Only a few clearly outdated websites were found, so we included the best additional prospects."
        : undefined;

    return responseWithLeads({
      niche,
      city,
      leads: selectedLeads,
      message: fallbackMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isTimeout = /timeout|aborted/i.test(message);

    return responseWithLeads({
      niche,
      city,
      leads: [],
      message: isTimeout
        ? "Live scan timed out. Please retry or narrow your niche/city search."
        : `Live scan failed: ${message}`,
    });
  }
}
