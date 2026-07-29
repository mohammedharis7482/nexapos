"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Breadcrumbs, ModuleNavigation, salesNavigation } from "@/components/layout/module-navigation";
import { Card, SummaryCard } from "@/components/ui/card";
import { MoneyDisplay, PageHeader } from "@/components/ui/display";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { FormField, MoneyInput, Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import { shiftService } from "@/services/shift.service";
import type { CashierShift } from "@/types/shift";

export default function ShiftPage() {
  const [shift, setShift] = useState<CashierShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setShift((await shiftService.current()).data); setError(null); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Shift could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function open(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try { setShift((await shiftService.open(values.opening_cash || "0.00", values.opening_note)).data); setError(null); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Shift could not be opened."); }
    finally { setBusy(false); }
  }
  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!shift) return; setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try { await shiftService.close(shift.id, values.counted_closing_cash, values.closing_note); setCloseOpen(false); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Shift could not be closed."); }
    finally { setBusy(false); }
  }
  if (loading) return <PageSkeleton />;
  if (error && !shift) return <ErrorState title="Shift unavailable" description={error} onRetry={() => void load()} />;
  if (!shift) return <div className="page-stack"><Breadcrumbs items={[{ label: "Sales", href: "/sales" }, { label: "Shifts", href: "/sales/shifts" }, { label: "Current Shift" }]} /><ModuleNavigation label="Sales sections" items={salesNavigation} /><PageHeader eyebrow="Cash drawer" title="Open your shift" description="Enter the physical cash float before completing sales." />{error ? <Alert title={error} /> : null}<Card className="max-w-xl p-6"><form className="space-y-5" onSubmit={open}><FormField label="Opening cash" htmlFor="opening-cash"><MoneyInput id="opening-cash" name="opening_cash" defaultValue="0.00" required /></FormField><FormField label="Opening note (optional)" htmlFor="opening-note"><Input id="opening-note" name="opening_note" /></FormField><Button className="w-full" type="submit" loading={busy}>Open Shift</Button></form></Card></div>;
  const summary = shift.summary;
  return <div className="page-stack"><Breadcrumbs items={[{ label: "Sales", href: "/sales" }, { label: "Shifts", href: "/sales/shifts" }, { label: "Current Shift" }]} /><ModuleNavigation label="Sales sections" items={salesNavigation} /><PageHeader eyebrow="Cash drawer" title="Current Shift" description={`Opened ${new Date(shift.opened_at).toLocaleString()}`} action={<Button variant="outline" onClick={() => setCloseOpen(true)}>Close Shift</Button>} />{error ? <Alert title={error} /> : null}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="Opening cash" value={<MoneyDisplay value={summary.opening_cash} />} /><SummaryCard label="Completed bills" value={summary.completed_bills} /><SummaryCard label="Cash sales" value={<MoneyDisplay value={summary.cash_sales} />} /><SummaryCard label="Card sales" value={<MoneyDisplay value={summary.card_sales} />} /><SummaryCard label="Expected drawer" value={<MoneyDisplay value={summary.expected_closing_cash} />} /><SummaryCard label="Gross sales" value={<MoneyDisplay value={summary.gross_sales} />} /></div><Link href="/billing" className="premium-action-primary w-fit">Start New Bill</Link><Dialog open={closeOpen} onOpenChange={setCloseOpen} title="Close shift" description={`Expected drawer: QAR ${summary.expected_closing_cash}`}><form className="space-y-5" onSubmit={close}><FormField label="Counted closing cash" htmlFor="counted-cash"><MoneyInput id="counted-cash" name="counted_closing_cash" required /></FormField><FormField label="Closing note (optional)" htmlFor="closing-note"><Input id="closing-note" name="closing_note" /></FormField><Button className="w-full" type="submit" loading={busy}>Confirm and close shift</Button></form></Dialog></div>;
}
