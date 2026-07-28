"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { FormField, Input, PercentageInput, Textarea } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { saasService } from "@/services/saas.service";
import type { OnboardingState } from "@/types/saas";

const steps = ["Welcome", "Business profile", "Regional settings", "Receipt setup", "Catalogue setup", "Invite team", "Ready"];

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setState((await saasService.onboarding()).data); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Onboarding could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
      const response = await saasService.saveOnboarding({ ...values, next_step: Math.min(state.current_step + 1, 7) });
      setState(response.data);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Progress could not be saved."); }
    finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true);
    try {
      await saasService.completeOnboarding();
      await refreshUser();
      router.replace("/dashboard");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Onboarding could not be completed."); }
    finally { setBusy(false); }
  }
  if (loading) return <PageSkeleton />;
  if (!state) return <ErrorState title="Onboarding unavailable" description={error ?? "No onboarding state exists."} onRetry={() => void load()} />;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Shop setup" title={steps[state.current_step - 1]} description="Progress is stored securely. Optional catalogue and team setup can be completed in their full workspaces." />
      <ol className="grid grid-cols-7 gap-1" aria-label="Onboarding progress">{steps.map((step, index) => <li key={step} className={`h-2 rounded-full ${index < state.current_step ? "bg-primary" : "bg-surface-muted"}`} aria-label={`${step}${index + 1 === state.current_step ? ", current step" : ""}`} />)}</ol>
      {error ? <Alert title={error} /> : null}
      <Card className="p-5 sm:p-7">
        {state.current_step < 7 ? (
          <form onSubmit={save} className="space-y-5">
            <FormField label="Shop name" htmlFor="onboard-name"><Input id="onboard-name" name="name" defaultValue={state.name} required /></FormField>
            <FormField label="Legal name" htmlFor="onboard-legal"><Input id="onboard-legal" name="legal_name" defaultValue={state.legal_name} /></FormField>
            <FormField label="Address" htmlFor="onboard-address"><Textarea id="onboard-address" name="address" defaultValue={state.address} /></FormField>
            <div className="grid gap-5 sm:grid-cols-2"><FormField label="City" htmlFor="onboard-city"><Input id="onboard-city" name="city" defaultValue={state.city} /></FormField><FormField label="Phone" htmlFor="onboard-phone"><Input id="onboard-phone" name="phone" defaultValue={state.phone} /></FormField></div>
            <FormField label="Default tax rate" htmlFor="onboard-tax"><PercentageInput id="onboard-tax" name="default_tax_rate" defaultValue={state.default_tax_rate} /></FormField>
            <FormField label="Receipt footer" htmlFor="onboard-footer"><Textarea id="onboard-footer" name="receipt_footer" defaultValue={state.receipt_footer} /></FormField>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => void saasService.saveOnboarding({ next_step: Math.min(state.current_step + 1, 7) }).then((response) => setState(response.data))}>Skip optional step</Button><Button type="submit" loading={busy}>Save and continue</Button></div>
          </form>
        ) : <div className="text-center"><h2 className="text-xl font-bold">Your shop is ready</h2><p className="mt-2 text-sm text-foreground-muted">Start using the workspace. Add catalogue and team details whenever you are ready.</p><Button className="mt-6" onClick={() => void finish()} loading={busy}>Start using NexaPOS</Button></div>}
      </Card>
    </div>
  );
}
