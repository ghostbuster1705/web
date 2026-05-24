import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { auditBusinessSite, searchPlaces } from "@/lib/scan/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const FREE_SCAN_LIMIT_PER_MONTH = 5;
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

  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDemo = !user;
  let currentPlan: "free" | "pro" = "free";
  let scanId: string | null = null;
  let resultLimit = 3;

  if (user) {
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("plan, scans_used_this_month")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to load user plan information" },
        { status: 500 },
      );
    }

    if (
      profile.plan === "free" &&
      profile.scans_used_this_month >= FREE_SCAN_LIMIT_PER_MONTH
    ) {
      return NextResponse.json(
        { error: "Monthly free scan limit reached" },
        { status: 403 },
      );
    }

    currentPlan = profile.plan;
    resultLimit = currentPlan === "pro" ? 50 : 10;

    const { data: createdScan, error: createScanError } = await admin
      .from("scans")
      .insert({
        user_id: user.id,
        niche,
        city,
        status: "running",
        result_count: 0,
      })
      .select("id")
      .single();

    if (createScanError) {
      return NextResponse.json(
        { error: "Could not create scan record" },
        { status: 500 },
      );
    }

    scanId = createdScan.id;
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
      if (scanId) {
        await admin
          .from("scans")
          .update({ status: "done", result_count: 0 })
          .eq("id", scanId);
      }

      return NextResponse.json({
        scan_id: scanId,
        leads_count: 0,
        leads: [],
        message:
          "No businesses found, try a broader niche or different city",
      });
    }

    const leads = [];
    for (const business of businesses) {
      if (leads.length >= resultLimit) {
        break;
      }

      if (!business.website) {
        continue;
      }

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

    if (scanId && user) {
      const { error: leadsInsertError } = await admin.from("leads").insert(
        leads.map((lead) => ({
          scan_id: scanId,
          business_name: lead.businessName,
          website_url: lead.websiteUrl,
          phone: lead.phone,
          address: lead.address,
          google_place_id: lead.googlePlaceId,
          score: lead.score,
          issues: lead.issues,
          tech_stack: lead.techStack,
          page_speed: lead.pageSpeed,
          has_https: lead.hasHttps,
          has_mobile: lead.hasMobile,
          has_analytics: lead.hasAnalytics,
          last_modified_year: lead.lastModifiedYear,
        })),
      );

      if (leadsInsertError) {
        throw new Error(`Lead insert failed: ${leadsInsertError.message}`);
      }

      const { error: updateScanError } = await admin
        .from("scans")
        .update({ status: "done", result_count: leads.length })
        .eq("id", scanId);

      if (updateScanError) {
        throw new Error(`Scan update failed: ${updateScanError.message}`);
      }

      const { data: profile } = await admin
        .from("users")
        .select("plan, scans_used_this_month")
        .eq("id", user.id)
        .single();

      if (profile?.plan === "free") {
        await admin
          .from("users")
          .update({ scans_used_this_month: profile.scans_used_this_month + 1 })
          .eq("id", user.id);
      }
    }

    return NextResponse.json({
      scan_id: scanId,
      leads_count: leads.length,
      leads: leads.map((lead) => ({
        ...lead,
        tier: leadTier(lead.score),
      })),
      mode: isDemo ? "demo" : currentPlan,
    });
  } catch (error) {
    if (scanId) {
      await admin.from("scans").update({ status: "error" }).eq("id", scanId);
    }

    return NextResponse.json(
      {
        error: "Scan failed. Please try again.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
