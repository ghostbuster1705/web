import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16 text-zinc-100">
      <h1 className="text-4xl font-bold">Pricing</h1>
      <p className="mt-3 text-zinc-300">
        Simple plans for freelancers and agencies in Germany.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700">
            <p>5 scans/month</p>
            <p>10 results/scan</p>
            <p>No outreach email generation</p>
            <p>No CSV export</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pro — €29/month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700">
            <p>Unlimited scans</p>
            <p>50 results/scan</p>
            <p>German outreach email generation</p>
            <p>CSV export</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
