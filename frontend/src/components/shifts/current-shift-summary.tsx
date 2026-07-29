"use client";

import { Clock3, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, MoneyDisplay } from "@/components/ui/display";
import { Skeleton } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { shiftService } from "@/services/shift.service";
import type { CashierShift } from "@/types/shift";

export function CurrentShiftSummary() {
  const started = useRef(false);
  const [shift, setShift] = useState<CashierShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShift((await shiftService.current()).data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Current shift could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  if (loading) return <Skeleton className="h-32" aria-label="Loading current shift" />;

  return (
    <Card className="p-4 sm:p-5" aria-labelledby="current-shift-summary-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Clock3 className="size-5 text-primary" aria-hidden="true" />
            <h2 id="current-shift-summary-title" className="font-bold">Current Shift</h2>
            {shift ? <Badge tone="success">Open</Badge> : null}
          </div>
          {error ? (
            <p className="mt-2 text-sm text-danger" role="alert">Shift status is temporarily unavailable.</p>
          ) : shift ? (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground-secondary">
              <span>Opened {new Date(shift.opened_at).toLocaleString()}</span>
              <span>{shift.summary.completed_bills} completed bills</span>
              <span><MoneyDisplay value={shift.summary.gross_sales} /> sales</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-foreground-muted">Open a shift before completing a bill.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {error ? <Button size="sm" variant="secondary" onClick={() => void load()}>Try again</Button> : null}
          {!error && !shift ? <Link className="premium-action-primary" href="/sales/shifts/current">Open Shift</Link> : null}
          {shift ? (
            <>
              <Link className="premium-action-secondary" href="/sales/shifts/current">View Shift</Link>
              <Link className="premium-action-primary" href="/billing"><ShoppingCart className="size-4" />Continue Billing</Link>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
