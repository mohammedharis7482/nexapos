"use client";

import { Boxes, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, SummaryCard } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api-client";
import { saasService } from "@/services/saas.service";
import type { Plan, Subscription } from "@/types/saas";

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [current, available] = await Promise.all([saasService.subscription(), saasService.plans()]);
      setSubscription(current.data);
      setPlans(available.data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Subscription could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  if (loading) return <PageSkeleton />;
  if (error || !subscription) return <ErrorState title="Subscription unavailable" description={error ?? "No subscription exists."} onRetry={() => void load()} />;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="SaaS account" title="Subscription" description="Review the current plan, trial lifecycle, and authoritative usage limits." action={<Badge tone={subscription.status === "ACTIVE" ? "success" : "warning"}>{subscription.status.replaceAll("_", " ").toLowerCase()}</Badge>} />
      {["PAST_DUE", "SUSPENDED"].includes(subscription.status) ? <Alert title={subscription.status === "SUSPENDED" ? "Business changes are suspended." : "Payment is past due."} tone="warning">Shop data remains preserved. Contact support to resolve account access.</Alert> : null}
      <Card className="p-5 sm:p-7">
        <p className="type-eyebrow text-primary">Current plan</p>
        <h2 className="mt-2 text-2xl font-bold">{subscription.plan.name}</h2>
        <p className="mt-2 text-sm text-foreground-muted">{subscription.plan.description}</p>
        {subscription.trial_ends_at ? <p className="mt-4 text-sm">Trial ends {new Intl.DateTimeFormat("en-QA", { dateStyle: "medium" }).format(new Date(subscription.trial_ends_at))}</p> : null}
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Active users" value={`${subscription.usage.active_users} / ${subscription.usage.max_users}`} footer={<Users className="size-4" />} />
        <SummaryCard label="Active products" value={`${subscription.usage.active_products} / ${subscription.usage.max_products}`} footer={<Boxes className="size-4" />} />
      </div>
      <section><h2 className="type-section-title">Available plans</h2><div className="mt-3 grid gap-4 md:grid-cols-3">{plans.map((plan) => <Card key={plan.code} className="p-5"><Badge tone={plan.code === subscription.plan.code ? "primary" : "neutral"}>{plan.code === subscription.plan.code ? "Current" : "Available"}</Badge><h3 className="mt-3 font-bold">{plan.name}</h3><p className="mt-2 text-sm text-foreground-muted">{plan.max_users} users · {plan.max_products} products</p><Button className="mt-5 w-full" variant="outline" disabled>Contact support</Button></Card>)}</div></section>
      <Alert title="Online subscription payment is not connected." tone="info">No card details or successful payment state are collected by NexaPOS in this phase.</Alert>
    </div>
  );
}
