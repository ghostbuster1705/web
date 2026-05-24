import { notFound, redirect } from "next/navigation";

import { LeadsTable, type ScanLead } from "@/components/scan/leads-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classifyLead } from "@/lib/scan/classification";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: {
    id: string;
  };
};

function jsonArrayToStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export default async function ScanResultPage({ params }: RouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .select("id, niche, city, status, result_count, created_at")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (scanError || !scan) {
    notFound();
  }

  const { data: rawLeads } = await supabase
    .from("leads")
    .select(
      "id, business_name, website_url, score, issues, page_speed, has_https, has_mobile, has_analytics, tech_stack, outreach_email",
    )
    .eq("scan_id", scan.id)
    .order("score", { ascending: true, nullsFirst: false });

  const leads: ScanLead[] = (rawLeads ?? []).map((lead) => ({
    ...lead,
    issues: jsonArrayToStrings(lead.issues),
    tech_stack: jsonArrayToStrings(lead.tech_stack),
  }));

  const scores = leads
    .map((lead) => lead.score)
    .filter((score): score is number => typeof score === "number");
  const avgScore =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((acc, score) => acc + score, 0) / scores.length);

  const hotCount = leads.filter((lead) => classifyLead(lead.score) === "hot").length;
  const warmCount = leads.filter((lead) => classifyLead(lead.score) === "warm").length;

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
