import { ProtectedBoundary } from "@/components/auth/protected-boundary";
import { AppShell } from "@/components/layout/app-shell";

export default function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ProtectedBoundary>
      <AppShell>{children}</AppShell>
    </ProtectedBoundary>
  );
}
