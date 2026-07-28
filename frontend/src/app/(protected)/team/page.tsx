"use client";

import { UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, SummaryCard } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { FormField, Input, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { saasService } from "@/services/saas.service";
import type { Invitation, ManagedUser, Usage } from "@/types/saas";

export default function TeamPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [team, pending] = await Promise.all([saasService.users(), saasService.invitations()]);
      setUsers(team.data.results);
      setUsage(team.data.usage);
      setInvitations(pending.data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Team information could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? users.filter((member) => `${member.full_name} ${member.email} ${member.username}`.toLowerCase().includes(value)) : users;
  }, [query, users]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
      await saasService.invite({
        email: values.email ?? "",
        role: values.role ?? "CASHIER",
        full_name: values.full_name,
      });
      setInviteOpen(false);
      setNotice("Invitation sent.");
      await load();
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : "Invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }
  async function action(id: string, kind: "activate" | "deactivate") {
    if (!window.confirm(`Confirm user ${kind}?`)) return;
    try {
      await saasService.userAction(id, kind);
      await load();
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : "User could not be updated.");
    }
  }

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState title="Team unavailable" description={error} onRetry={() => void load()} />;
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Administration" title="Team" description="Manage your shop users and secure invitations." action={<Button onClick={() => setInviteOpen(true)} leadingIcon={<UserPlus className="size-4" />}>Invite user</Button>} />
      {notice ? <Alert title={notice} tone={notice === "Invitation sent." ? "success" : "warning"} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Active users" value={`${usage?.active_users ?? 0} / ${usage?.max_users ?? 0}`} footer="Deactivated users do not consume a seat." />
        <SummaryCard label="Pending invitations" value={invitations.filter((item) => item.status === "PENDING").length} footer="Invitations expire automatically." />
      </div>
      <Input aria-label="Search team" placeholder="Search name, email, or username" value={query} onChange={(event) => setQuery(event.target.value)} />
      {filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((member) => (
            <Card key={member.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{member.full_name}</p>{member.is_primary_owner ? <Badge tone="primary">Primary owner</Badge> : null}<Badge tone={member.status === "ACTIVE" ? "success" : "neutral"}>{member.status.toLowerCase()}</Badge></div>
                <p className="mt-1 text-sm text-foreground-muted">{member.email || "No email"} · @{member.username} · {member.role.toLowerCase()}</p>
              </div>
              {!member.is_primary_owner && member.id !== user?.id ? <Button variant="outline" onClick={() => void action(member.id, member.status === "ACTIVE" ? "deactivate" : "activate")}>{member.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button> : null}
            </Card>
          ))}
        </div>
      ) : <EmptyState icon={Users} title="No matching users" description="Adjust the search or invite a team member." />}
      <section>
        <h2 className="type-section-title">Invitations</h2>
        <div className="mt-3 grid gap-3">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex-1"><p className="font-semibold">{invitation.email}</p><p className="text-sm text-foreground-muted">{invitation.role.toLowerCase()} · {invitation.status.toLowerCase()}</p></div>
              {invitation.status === "PENDING" ? <div className="flex gap-2"><Button variant="outline" onClick={() => void saasService.invitationAction(invitation.id, "resend").then(load)}>Resend</Button><Button variant="ghost" onClick={() => void saasService.invitationAction(invitation.id, "revoke").then(load)}>Revoke</Button></div> : null}
            </Card>
          ))}
          {!invitations.length ? <EmptyState title="No invitations" description="Invite an owner or cashier when your team is ready." compact /> : null}
        </div>
      </section>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen} title="Invite user" description={`${usage?.active_users ?? 0} of ${usage?.max_users ?? 0} active seats used.`}>
        <form className="space-y-5" onSubmit={invite}>
          <FormField label="Email" htmlFor="invite-email"><Input id="invite-email" name="email" type="email" required /></FormField>
          <FormField label="Full name (optional)" htmlFor="invite-name"><Input id="invite-name" name="full_name" /></FormField>
          <FormField label="Role" htmlFor="invite-role"><Select id="invite-role" name="role"><option value="CASHIER">Cashier — billing and own sales</option>{user?.is_primary_owner ? <option value="OWNER">Owner — administration and operations</option> : null}</Select></FormField>
          <Button className="w-full" type="submit" loading={busy}>Send secure invitation</Button>
        </form>
      </Dialog>
    </div>
  );
}
