"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Receipt } from "@/components/sales/receipt";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { salesService } from "@/services/sales.service";
import type { ReceiptData } from "@/types/sales";

export default function ReceiptPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  return (
    <div className="space-y-4 pb-6">
      <div className="print-controls mx-auto flex max-w-[560px] items-center justify-between">
        <Link href={`/sales/${saleId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4" /> Sale details</Link>
        <Button leadingIcon={<Printer className="size-4" />} onClick={() => window.print()}>Print Receipt</Button>
      </div>
      <Receipt data={receipt} />
    </div>
  );
}
