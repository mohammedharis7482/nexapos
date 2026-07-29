"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Receipt } from "@/components/sales/receipt";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/display";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { salesService } from "@/services/sales.service";
import type { ReceiptData } from "@/types/sales";

export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await salesService.receipt(saleId);
      setReceipt(response.data);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Receipt could not be loaded.");
    }
  }, [saleId]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  if (error) return <ErrorState title="Receipt unavailable" description={error} onRetry={() => void load()} />;
  if (!receipt) return <Skeleton className="mx-auto h-[680px] max-w-[360px]" />;
  async function reprint() {
    setReprinting(true);
    try {
      await salesService.reprint(saleId);
      window.print();
    } finally {
      setReprinting(false);
    }
  }
  return (
    <div className="page-stack print:!p-0">
      <div className="print-controls mx-auto w-full max-w-3xl">
        <PageHeader eyebrow="Customer copy" title="Receipt preview" description={receipt.sale.sale_number} action={<div className="flex gap-2"><Link href={`/sales/${saleId}`} className="premium-action-secondary"><ArrowLeft className="size-4" /> Sale details</Link><Button leadingIcon={<Printer className="size-4" />} loading={reprinting} onClick={() => void reprint()}>Reprint Receipt</Button></div>} />
      </div>
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-surface-secondary p-4 shadow-[var(--shadow-card)] sm:p-8">
        <Receipt data={receipt} />
      </div>
    </div>
  );
}
