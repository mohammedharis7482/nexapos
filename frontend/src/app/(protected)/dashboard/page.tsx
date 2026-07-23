"use client";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, PageHeader } from "@/components/ui/display";
import { useAuth } from "@/providers/auth-provider";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user.full_name.split(" ")[0]}`}
        description={`You are signed in to ${user.shop.name}.`}
        action={
          <Button leadingIcon={<ShoppingCart className="size-5" />}>
            Start New Bill
          </Button>
        }
      />
      <Card className="p-6 sm:p-8">
        <div className="max-w-xl">
          <Badge tone="primary">{user.role === "OWNER" ? "Owner" : "Cashier"}</Badge>
          <h2 className="mt-4 text-xl font-bold">Your workspace is ready</h2>
          <p className="mt-2 text-text-secondary">
            Dashboard data will be added in a later module. This page currently
            verifies your secure session and responsive application shell.
          </p>
        </div>
      </Card>
    </div>
  );
}
