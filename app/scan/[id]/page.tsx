"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LeadsTable, type ScanLead } from "@/components/scan/leads-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classifyLead } from "@/lib/scan/classification";

type RouteContext = {
  params: {
    id: string;
  };
};

type PublicStoredLead = {
  businessName: string;
  websiteUrl: string;
  score: number;
  issues: string[];
  pageSpeed?: number | null;
  hasHttps?: boolean;
  hasMobile?: boolean;
  hasAnalytics?: boolean;
  techStack?: string[];
  googlePlaceId?: string;
};

type PublicStoredScan = {
  id: string;
  niche: string;
  city: string;
  status: "done";
  createdAt: string;
  leads: PublicStoredLead[];
};

function mapToTableLead(lead: PublicStoredLead, index: number): ScanLead {
  return {
    id: lead.googlePlaceId ?? `${lead.businessName}-${index}`,
    business_name: lead.businessName,
    website_url: lead.websiteUrl ?? null,
    score: typeof lead.score === "number" ? lead.score : null,
    issues: Array.isArray(lead.issues) ? lead.issues : [],
    page_speed: typeof lead.pageSpeed === "number" ? lead.pageSpeed : null,
    has_https: typeof lead.hasHttps === "boolean" ? lead.hasHttps : null,
    has_mobile: typeof lead.hasMobile === "boolean" ? lead.hasMobile : null,
    has_analytics: typeof lead.hasAnalytics === "boolean" ? lead.hasAnalytics : null,
    tech_stack: Array.isArray(lead.techStack) ? lead.techStack : [],
    outreach_email: null,
  };
}

export default function ScanResultPage({ params }: RouteContext) {
  const [scan, setScan] = useState<PublicStoredScan | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("siteaudit:lastScan");
      if (!raw) return;
      const parsed = JSON.parse(raw) as PublicStoredScan;
      if (params.id === "latest" || parsed.id === params.id) {
        setScan(parsed);
      }
    } catch {
      setScan(null);
    }
  }, [params.id]);

  const leads = useMemo(() => {
    if (!scan) return [];
    return scan.leads.map(mapToTableLead);
  }, [scan]);

  const scores = leads
    .map((lead) => lead.score)
    .filter((score): score is number => typeof score === "number");
  const avgScore =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((acc, score) => acc + score, 0) / scores.length);
  const hotCount = leads.filter((lead) => classifyLead(lead.score) === "hot").length;
  const warmCount = leads.filter((lead) => classifyLead(lead.score) === "warm").length;

  if (!scan) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>No scan results found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-700">
            <p>Run a new scan on the homepage. No registration is required.</p>
            <Link href="/">
              <Button>Back to scanner</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Scan Results</h1>
        <p className="mt-2 text-sm text-zinc-300">
          {scan.niche} in {scan.city} · status: {scan.status}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total found</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{leads.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hot leads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">
            {hotCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Warm leads</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-600">
            {warmCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Average score</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{avgScore}</CardContent>
        </Card>
      </section>

      <LeadsTable leads={leads} />
    </main>
  );
}
