import Link from "next/link";

import { DemoScanForm } from "@/components/landing/demo-scan-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURE_ITEMS = [
  "Google Places lead discovery for German local businesses",
  "Website quality audit with score from 0 to 100",
  "Automatic issue detection (mobile, HTTPS, analytics, speed)",
  "AI-generated German outreach email for Pro users",
];

const FAQ_ITEMS = [
  {
    q: "Kann ich SiteAudit Pro kostenlos testen?",
    a: "Ja, der Free Plan enthält 5 Scans pro Monat und bis zu 10 Ergebnisse pro Scan.",
  },
  {
    q: "Welche Städte werden unterstützt?",
    a: "Alle Städte, die über Google Places auffindbar sind, inklusive Berlin und Umgebung.",
  },
  {
    q: "Wie schnell ist ein Scan?",
    a: "Je nach Anzahl der Websites dauert ein Scan in der Regel wenige Sekunden bis etwa eine Minute.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
              SiteAudit Pro
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Outdated Website Scanner &amp; Redesign Lead Generator
            </h1>
            <p className="max-w-2xl text-lg text-zinc-300">
              Finde lokale Unternehmen mit veralteten Websites in Minuten.
              Priorisiere die besten Leads und starte direkt mit einer
              professionellen Kontaktaufnahme.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/signup">
                <Button size="lg">Jetzt starten</Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="secondary">
                  Preise ansehen
                </Button>
              </Link>
            </div>
            <ul className="grid gap-2 pt-2 text-sm text-zinc-300 sm:grid-cols-2">
              {FEATURE_ITEMS.map((feature) => (
                <li key={feature} className="rounded-md border border-zinc-800 p-3">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <DemoScanForm />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-14 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Free Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700">
            <p>5 scans / month</p>
            <p>10 results / scan</p>
            <p>No email generation</p>
            <p>No CSV export</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pro Plan — €29 / month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700">
            <p>Unlimited scans</p>
            <p>50 results / scan</p>
            <p>German AI outreach emails</p>
            <p>CSV export and saved lead lists</p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-4 text-2xl font-semibold">FAQ</h2>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <Card key={item.q}>
              <CardHeader>
                <CardTitle className="text-base">{item.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-700">{item.a}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
