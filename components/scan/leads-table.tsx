"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { classifyLead, type LeadTier } from "@/lib/scan/classification";

export type ScanLead = {
  id: string;
  business_name: string;
  website_url: string | null;
  score: number | null;
  issues: string[];
  page_speed: number | null;
  has_https: boolean | null;
  has_mobile: boolean | null;
  has_analytics: boolean | null;
  tech_stack: string[];
  outreach_email: string | null;
};

type SortDirection = "asc" | "desc";
type FilterType = "all" | LeadTier;

export function LeadsTable({ leads }: { leads: ScanLead[] }) {
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedLead, setSelectedLead] = useState<ScanLead | null>(null);

  const filteredAndSortedLeads = useMemo(() => {
    const filtered = leads.filter((lead) => {
      if (filter === "all") return true;
      return classifyLead(lead.score) === filter;
    });

    return filtered.sort((a, b) => {
      const aScore = a.score ?? 1000;
      const bScore = b.score ?? 1000;
      return sortDirection === "asc" ? aScore - bScore : bScore - aScore;
    });
  }, [filter, leads, sortDirection]);

  async function copyEmail() {
    if (!selectedLead?.outreach_email) return;
    await navigator.clipboard.writeText(selectedLead.outreach_email);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">Filter</label>
          <select
            className="h-9 rounded-md border border-zinc-300 px-3 text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterType)}
          >
            <option value="all">All</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSortDirection((current) =>
                current === "asc" ? "desc" : "asc",
              )
            }
          >
            Sort by score ({sortDirection})
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Website</TableHead>
              <TableHead className="w-[110px]">Tier</TableHead>
              <TableHead className="w-[90px]">Score</TableHead>
              <TableHead className="w-[120px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedLeads.map((lead) => {
              const tier = classifyLead(lead.score);
              return (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.business_name}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-zinc-500">
                    {lead.website_url ?? "n/a"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tier}>{tier}</Badge>
                  </TableCell>
                  <TableCell>{lead.score ?? "n/a"}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedLead(lead)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <aside className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900">
        {selectedLead ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">{selectedLead.business_name}</h3>
              <p className="text-xs text-zinc-500">{selectedLead.website_url}</p>
            </div>

            <div>
              <p className="text-sm font-medium">Issues</p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                {selectedLead.issues.length === 0 && <li>No major issues found.</li>}
                {selectedLead.issues.map((issue) => (
                  <li key={issue} className="list-inside list-disc">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Email preview</p>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                {selectedLead.outreach_email ?? "No outreach email generated yet."}
              </div>
              <Button size="sm" variant="outline" onClick={copyEmail}>
                Copy email
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Select a lead to view issue details and outreach preview.
          </p>
        )}
      </aside>
    </div>
  );
}
