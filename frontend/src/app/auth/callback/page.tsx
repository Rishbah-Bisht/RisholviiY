"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("pyq_token", token);
    }
    router.replace("/");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="rounded-lg bg-white p-6 text-sm text-[var(--muted)] shadow-sm">
        Completing sign in...
      </div>
    </main>
  );
}
