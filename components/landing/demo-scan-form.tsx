"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type DemoLead = {
  businessName: string;
  websiteUrl: string;
  score: number;
  issues: string[];
  tier: "hot" | "warm" | "cold";
};

type ScanResponse = {
  leads?: DemoLead[];
  message?: string;
  error?: string;
};

const CRITERIA_OPTIONS = [
  { key: "https", label: "HTTPS" },
  { key: "mobile", label: "Mobile viewport" },
  { key: "pagespeed", label: "PageSpeed" },
  { key: "copyright", label: "Old copyright year" },
  { key: "analytics", label: "Analytics scripts" },
  { key: "social", label: "Social links" },
];

const NICHE_OPTIONS = [
  "Restaurant",
  "Zahnarzt",
  "Immobilienmakler",
  "Fitnessstudio",
  "Rechtsanwalt",
  "Kosmetikstudio",
];

function tierLabel(tier: DemoLead["tier"]) {
  if (tier === "hot") return "Hot lead";
  if (tier === "warm") return "Warm lead";
  return "Cold lead";
}

export function DemoScanForm() {
  const [niche, setNiche] = useState("Restaurant");
  const [city, setCity] = useState("Berlin");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [results, setResults] = useState<DemoLead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/scan/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ niche, city, criteria }),
      });

      const json = (await response.json()) as ScanResponse;
      if (!response.ok) {
        setError(json.error ?? "Scan failed.");
        setResults([]);
        return;
      }

      setResults((json.leads ?? []).slice(0, 3));
      setMessage(json.message ?? null);
    } catch {
      setError("Network error. Please try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleCriterion(criterion: string) {
    setCriteria((current) =>
      current.includes(criterion)
        ? current.filter((value) => value !== criterion)
        : [...current, criterion],
    );
  }

  return (
    <Card className="border-zinc-200">
      <CardHeader>
        <CardTitle className="text-2xl">Live Demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Niche</label>
              <Select value={niche} onChange={(event) => setNiche(event.target.value)}>
                {NICHE_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">City</label>
              <Input value={city} onChange={(event) => setCity(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-700">Criteria</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CRITERIA_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 p-2 text-sm text-zinc-700"
                >
                  <Checkbox
                    checked={criteria.includes(option.key)}
                    onChange={() => toggleCriterion(option.key)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
            {isLoading ? "Scanning..." : "Find leads"}
          </Button>
        </form>

        {message && (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            {message}
          </p>
        )}

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100"
              />
            ))}
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {results.map((lead) => (
              <div key={lead.websiteUrl} className="rounded-lg border border-zinc-200 p-3">
                <p className="font-medium text-zinc-900">{lead.businessName}</p>
                <p className="mt-1 text-xs text-zinc-500">{lead.websiteUrl}</p>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant={lead.tier}>{tierLabel(lead.tier)}</Badge>
                  <span className="text-sm font-semibold text-zinc-900">{lead.score}/100</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
