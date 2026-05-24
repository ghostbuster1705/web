import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Registrierung deaktiviert</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-700">
          <p>Der Service ist öffentlich — Sie können direkt ohne Konto scannen.</p>
          <Link href="/">
            <Button>Jetzt scannen</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
