import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function PublicAccountPage({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="surface-grid min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <Link href="/login" className="mb-7 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-white">
            <ShoppingCart className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-extrabold">NexaPOS</span>
        </Link>
        <Card className="p-5 sm:p-8">
          <p className="type-eyebrow text-primary">{eyebrow}</p>
          <h1 className="mt-2 type-page-title">{title}</h1>
          <p className="mt-2 type-body-sm text-foreground-muted">{description}</p>
          <div className="mt-7">{children}</div>
        </Card>
        {footer ? <div className="mt-5 text-center text-sm text-foreground-muted">{footer}</div> : null}
      </div>
    </main>
  );
}
