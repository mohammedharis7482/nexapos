"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppLoading } from "@/components/ui/feedback";
import { useAuth } from "@/providers/auth-provider";

export default function Home() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
    if (status === "unauthenticated") router.replace("/login");
  }, [router, status]);

  return <AppLoading message="Opening NexaPOS…" />;
}
