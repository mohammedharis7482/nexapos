"use client";

import { UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card, SummaryCard } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { FormField, Input, PasswordInput, Select } from "@/components/ui/input";
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
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
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
    return users.filter((member) => {
      const matchesSearch = !value || `${member.full_name} ${member.email} ${member.username}`.toLowerCase().includes(value);
      const matchesRole = roleFilter === "ALL" || member.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || member.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
      await saasService.createUser({
        email: values.email ?? "",
        role: values.role === "OWNER" ? "OWNER" : "CASHIER",
        full_name: values.full_name ?? "",
        username: values.username ?? "",
        temporary_password: values.temporary_password ?? "",
        temporary_password_confirm: values.temporary_password_confirm ?? "",
      });
      setCreateOpen(false);
      setNotice("Staff account created. Share the temporary credentials securely.");
      await load();
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : "Invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetTarget) return;
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
      await saasService.resetUserPassword(
        resetTarget.id,
        values.temporary_password ?? "",
        values.temporary_password_confirm ?? "",
      );
      setResetTarget(null);
      setNotice("Temporary password reset. Existing sessions were ended.");
      await load();
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : "Password could not be reset.");
    } finally { setBusy(false); }
  }
  async function editMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
      await saasService.updateUser(editTarget.id, {
        full_name: values.full_name ?? "",
        email: values.email ?? "",
      });
      setEditTarget(null);
      setNotice("Team member updated.");
      await load();
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : "Team member could not be updated.");
    } finally { setBusy(false); }
  }
  async function changeRole(member: ManagedUser) {
    const role = member.role === "OWNER" ? "CASHIER" : "OWNER";
    if (!window.confirm(`Change ${member.full_name} to ${role.toLowerCase()}? Their sessions will end.`)) return;
    try { await saasService.changeRole(member.id, role); await load(); }
    catch (caught) { setNotice(caught instanceof ApiError ? caught.message : "Role could not be changed."); }
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
      <PageHeader eyebrow="Administration" title="Team" description="Create staff accounts, assign roles, and control access to this shop." action={<Button onClick={() => setCreateOpen(true)} leadingIcon={<UserPlus className="size-4" />}>Add team member</Button>} />
      {notice ? <Alert title={notice} tone="info" /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Active users" value={`${usage?.active_users ?? 0} / ${usage?.max_users ?? 0}`} footer="Deactivated users do not consume a seat." />
        <SummaryCard label="Available seats" value={Math.max((usage?.max_users ?? 0) - (usage?.active_users ?? 0), 0)} footer="Inactive accounts do not consume a seat." />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_14rem]">
        <Input aria-label="Search team" placeholder="Search name, email, or username" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="ALL">All roles</option><option value="OWNER">Owners</option><option value="CASHIER">Cashiers</option>
        </Select>
        <Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="PASSWORD_CHANGE_REQUIRED">Password change required</option><option value="INACTIVE">Inactive</option>
        </Select>
      </div>
      {filtered.length ? (
        <div className="grid gap-3">
          {filtered.map((member) => (
            <Card key={member.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{member.full_name}</p>{member.is_primary_owner ? <Badge tone="primary">Primary owner</Badge> : null}<Badge tone={member.status === "ACTIVE" ? "success" : "neutral"}>{member.status.toLowerCase()}</Badge></div>
                <p className="mt-1 text-sm text-foreground-muted">{member.email || "No email"} · @{member.username} · {member.role.toLowerCase()}</p>
              </div>
              {!member.is_primary_owner && member.id !== user?.id ? <div className="flex flex-wrap gap-2">
                {member.available_actions.includes("edit") ? <Button variant="ghost" onClick={() => setEditTarget(member)}>Edit</Button> : null}
                {member.available_actions.includes("change_role") && user?.is_primary_owner ? <Button variant="ghost" onClick={() => void changeRole(member)}>Make {member.role === "OWNER" ? "cashier" : "owner"}</Button> : null}
                {member.available_actions.includes("reset_password") ? <Button variant="outline" onClick={() => setResetTarget(member)}>Reset password</Button> : null}
                <Button variant="outline" onClick={() => void action(member.id, member.is_active ? "deactivate" : "activate")}>{member.is_active ? "Deactivate" : "Activate"}</Button>
              </div> : null}
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Add team member" description={`${usage?.active_users ?? 0} of ${usage?.max_users ?? 0} active seats used.`}>
        <form className="space-y-5" onSubmit={createMember}>
          <FormField label="Full name" htmlFor="staff-name"><Input id="staff-name" name="full_name" required /></FormField>
          <FormField label="Username" htmlFor="staff-username"><Input id="staff-username" name="username" autoCapitalize="none" required /></FormField>
          <FormField label="Email (optional)" htmlFor="staff-email"><Input id="staff-email" name="email" type="email" /></FormField>
          <FormField label="Role" htmlFor="staff-role"><Select id="staff-role" name="role"><option value="CASHIER">Cashier — billing and permitted shop reads</option>{user?.is_primary_owner ? <option value="OWNER">Owner — daily operations and cashier management</option> : null}</Select></FormField>
          <FormField label="Temporary password" htmlFor="staff-password"><PasswordInput id="staff-password" name="temporary_password" autoComplete="new-password" required /></FormField>
          <FormField label="Confirm temporary password" htmlFor="staff-password-confirm"><PasswordInput id="staff-password-confirm" name="temporary_password_confirm" autoComplete="new-password" required /></FormField>
          <Button className="w-full" type="submit" loading={busy} disabled={(usage?.active_users ?? 0) >= (usage?.max_users ?? 0)}>Create staff account</Button>
        </form>
      </Dialog>
      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => { if (!open) setResetTarget(null); }} title="Reset staff password" description="This ends the user's existing sessions and requires a password change at next sign-in.">
        <form className="space-y-5" onSubmit={resetPassword}>
          <FormField label="Temporary password" htmlFor="reset-password"><PasswordInput id="reset-password" name="temporary_password" autoComplete="new-password" required /></FormField>
          <FormField label="Confirm temporary password" htmlFor="reset-password-confirm"><PasswordInput id="reset-password-confirm" name="temporary_password_confirm" autoComplete="new-password" required /></FormField>
          <Button className="w-full" type="submit" loading={busy}>Reset password and end sessions</Button>
        </form>
      </Dialog>
      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => { if (!open) setEditTarget(null); }} title="Edit team member" description="Username, shop membership, and primary ownership cannot be changed here.">
        {editTarget ? <form className="space-y-5" onSubmit={editMember}>
          <FormField label="Full name" htmlFor="edit-name"><Input id="edit-name" name="full_name" defaultValue={editTarget.full_name} required /></FormField>
          <FormField label="Email (optional)" htmlFor="edit-email"><Input id="edit-email" name="email" type="email" defaultValue={editTarget.email} /></FormField>
          <Button className="w-full" type="submit" loading={busy}>Save changes</Button>
        </form> : null}
      </Dialog>
    </div>
  );
}
