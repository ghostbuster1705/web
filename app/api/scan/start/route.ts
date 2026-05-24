import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { auditBusinessSite, searchPlaces } from "@/lib/scan/audit";

const MAX_PLACES = 20;

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
    const placesApiKey = getEnv("GOOGLE_PLACES_API_KEY");
    const businesses = await searchPlaces({
      niche,
      city,
      apiKey: placesApiKey,
      maxResults: MAX_PLACES,
    });

    if (businesses.length === 0) {
      return NextResponse.json({
        scan_id: null,
        niche,
        city,
        leads_count: 0,
        leads: [],
        message: "No businesses found, try a broader niche or different city",
        mode: "public",
      });
    }

    const leads = [];
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

      leads.push(auditedLead);
    }

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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Scan failed. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
