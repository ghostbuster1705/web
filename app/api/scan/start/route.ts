import { NextResponse } from "next/server";

import { getOptionalEnv } from "@/lib/env";
import { auditBusinessSite, type LeadAuditResult, searchPlaces } from "@/lib/scan/audit";

const MAX_PLACES = 20;
const BAD_LEAD_MAX_SCORE = 64;
const MAX_RETURNED_LEADS = 20;

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

    const auditedLeads = [];
    for (const business of businesses) {
      if (!business.website) continue;

      const auditedLead = await auditBusinessSite({
        businessName: business.name,
        websiteUrl: business.website,
        phone: business.formatted_phone_number,
        address: business.formatted_address,
        placeId: business.place_id,
        criteria,
      });

      auditedLeads.push(auditedLead);
    }

    const rankedLeads = auditedLeads.sort((a, b) => a.score - b.score);
    const badLeads = rankedLeads
      .filter((lead) => lead.score <= BAD_LEAD_MAX_SCORE)
      .slice(0, MAX_RETURNED_LEADS);

    if (badLeads.length === 0) {
      return responseWithLeads({
        niche,
        city,
        leads: [],
        message:
          "No clearly outdated websites found in this search. Try another niche or nearby city.",
      });
    }

    return responseWithLeads({
      niche,
      city,
      leads: badLeads,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Live scan failed: ${error.message}`
            : "Live scan failed. Please try again.",
      },
      { status: 502 },
    );
  }
}
