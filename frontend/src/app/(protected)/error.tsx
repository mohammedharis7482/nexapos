"use client";

import { UnexpectedError } from "@/components/ui/unexpected-error";

export default function ProtectedRouteError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <UnexpectedError retry={unstable_retry} />;
}
