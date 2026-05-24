import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Kein Login erforderlich</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-700">
          <p>SiteAudit Pro kann jetzt ohne Registrierung genutzt werden.</p>
          <Link href="/">
            <Button>Zum Scanner</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
