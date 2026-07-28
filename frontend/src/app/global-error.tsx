"use client";

import { UnexpectedError } from "@/components/ui/unexpected-error";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <UnexpectedError fullPage retry={unstable_retry} />
      </body>
    </html>
  );
}
