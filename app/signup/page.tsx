import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-700">
          <p>Supabase Auth UI placeholder (Google OAuth + Magic Link).</p>
          <div className="flex gap-3">
            <Button className="w-full" variant="secondary">
              Continue with Google
            </Button>
            <Button className="w-full">Magic Link</Button>
          </div>
          <p className="text-center text-zinc-500">
            Bereits registriert?{" "}
            <Link href="/login" className="text-emerald-600 underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
