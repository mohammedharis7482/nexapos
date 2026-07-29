"use client";

import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Breadcrumbs, ModuleNavigation, salesNavigation } from "@/components/layout/module-navigation";
import { MoneyDisplay, PageHeader, Badge } from "@/components/ui/display";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { shiftService } from "@/services/shift.service";
import type { CashierShift } from "@/types/shift";

export default function ShiftHistoryPage() {
  const [shifts, setShifts] = useState<CashierShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setShifts((await shiftService.list()).data.results); setError(null); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Shift history could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState title="Shift history unavailable" description={error} onRetry={() => void load()} />;
  return <div className="page-stack"><Breadcrumbs items={[{ label: "Sales", href: "/sales" }, { label: "Shifts" }]} /><ModuleNavigation label="Sales sections" items={salesNavigation} /><PageHeader eyebrow="Sales operations" title="Shifts" description="Review permitted drawer history, status, and reconciliation." />{shifts.length ? <div className="grid gap-3">{shifts.map((shift) => <Card key={shift.id} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><div><p className="text-xs text-text-muted">Cashier</p><p className="font-semibold">{shift.cashier.full_name}</p></div><div><p className="text-xs text-text-muted">Opened</p><p>{new Date(shift.opened_at).toLocaleString()}</p></div><div><p className="text-xs text-text-muted">Sales</p><MoneyDisplay value={shift.summary.gross_sales} /></div><div><p className="text-xs text-text-muted">Expected / counted</p><p><MoneyDisplay value={shift.summary.expected_closing_cash} /> / {shift.counted_closing_cash ? <MoneyDisplay value={shift.counted_closing_cash} /> : "—"}</p></div><div><Badge tone={shift.status === "OPEN" ? "success" : "neutral"}>{shift.status.toLowerCase()}</Badge><p className="mt-2 text-sm">Variance: {shift.cash_difference ? <MoneyDisplay value={shift.cash_difference} /> : "—"}</p></div></Card>)}</div> : <EmptyState title="No shifts yet" description="Shift history appears after staff open their drawer." />}</div>;
}
