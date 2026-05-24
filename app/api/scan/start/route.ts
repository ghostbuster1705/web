import { NextResponse } from "next/server";

import { getOptionalEnv } from "@/lib/env";
import {
  auditBusinessSite,
  type LeadAuditResult,
  searchPlaces,
} from "@/lib/scan/audit";

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

function createSampleLeads(niche: string, city: string): LeadAuditResult[] {
  return [
    {
      businessName: `${niche} am Alexanderplatz`,
      websiteUrl: "http://example-business-berlin.de",
      phone: null,
      address: `Alexanderplatz 1, ${city}`,
      googlePlaceId: "sample-place-1",
      score: 28,
      issues: [
        "No HTTPS detected",
        "Missing viewport meta tag (not mobile-ready)",
        "No Google Analytics / GTM detected",
      ],
      techStack: ["WordPress"],
      pageSpeed: 34,
      hasHttps: false,
      hasMobile: false,
      hasAnalytics: false,
      lastModifiedYear: 2012,
    },
    {
      businessName: `${niche} Mitte`,
      websiteUrl: "https://sample-local-site.de",
      phone: null,
      address: `Torstrasse 99, ${city}`,
      googlePlaceId: "sample-place-2",
      score: 52,
      issues: [
        "PageSpeed mobile score is low (45)",
        "No social profile links detected",
      ],
      techStack: ["Wix"],
      pageSpeed: 45,
      hasHttps: true,
      hasMobile: true,
      hasAnalytics: true,
      lastModifiedYear: null,
    },
    {
      businessName: `${niche} Prenzlauer Berg`,
      websiteUrl: "https://modern-sample-site.de",
      phone: null,
      address: `Kastanienallee 25, ${city}`,
      googlePlaceId: "sample-place-3",
      score: 77,
      issues: ["PageSpeed score unavailable"],
      techStack: ["Shopify"],
      pageSpeed: null,
      hasHttps: true,
      hasMobile: true,
      hasAnalytics: true,
      lastModifiedYear: null,
    },
  ];
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
    if (!placesApiKey) {
      return responseWithLeads({
        niche,
        city,
        leads: createSampleLeads(niche, city),
        message:
          "Live API keys are not configured yet. Showing sample leads so you can still use the scanner.",
      });
    }

    const businesses = await searchPlaces({
      niche,
      city,
      apiKey: placesApiKey,
      maxResults: MAX_PLACES,
    });

    if (businesses.length === 0) {
      return responseWithLeads({
        niche,
        city,
        leads: [],
        message: "No businesses found, try a broader niche or different city",
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

    return responseWithLeads({
      niche,
      city,
      leads,
    });
  } catch (error) {
    return responseWithLeads({
      niche,
      city,
      leads: createSampleLeads(niche, city),
      message:
        error instanceof Error
          ? `Live scan unavailable right now (${error.message}). Showing sample leads instead.`
          : "Live scan unavailable right now. Showing sample leads instead.",
    });
  }
}
