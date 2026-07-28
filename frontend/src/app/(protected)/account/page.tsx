"use client";

import { useState, type FormEvent } from "react";

import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { ShopIdDisplay } from "@/components/shops/shop-id-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { FormField, Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { ApiSuccess } from "@/types/auth";

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const response = await apiRequest<ApiSuccess<unknown>>("/auth/account/", { method: "PATCH", body: JSON.stringify(payload) });
      setMessage(response.message);
      await refreshUser();
    } catch (caught) { setMessage(caught instanceof ApiError ? caught.message : "Profile could not be updated."); }
    finally { setBusy(false); }
  }
  if (!user) return null;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Your account" title="Profile and security" description="Manage your own profile. Roles and shop access remain owner-controlled." action={<Badge tone="primary">{user.is_primary_owner ? "Primary owner" : user.role.toLowerCase()}</Badge>} />
      {message ? <Alert title={message} tone="info" /> : null}
      <Card className="max-w-3xl p-5 sm:p-7">
        <form className="space-y-5" onSubmit={submit}>
          <FormField label="Full name" htmlFor="account-name"><Input id="account-name" name="full_name" defaultValue={user.full_name} required /></FormField>
          <FormField label="Email" htmlFor="account-email" hint="Changing email requires verification."><Input id="account-email" name="email" type="email" defaultValue={user.email ?? ""} /></FormField>
          <FormField label="Username" htmlFor="account-username"><Input id="account-username" value={user.username} readOnly /></FormField>
          <FormField label="Shop" htmlFor="account-shop"><Input id="account-shop" value={user.shop.name} readOnly /></FormField>
          <ShopIdDisplay shopId={user.shop.id} />
          <div className="flex flex-wrap gap-2"><Button type="submit" loading={busy}>Save profile</Button><Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>Change password</Button></div>
        </form>
      </Card>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
