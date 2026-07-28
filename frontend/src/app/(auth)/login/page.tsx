"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes, ChartNoAxesCombined, ReceiptText, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AppLoading } from "@/components/ui/feedback";
import { FormField, Input, PasswordInput } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  loginSchema,
  type LoginFormValues,
} from "@/schemas/auth.schema";
import { useAuth } from "@/providers/auth-provider";

const REMEMBERED_SHOP_KEY = "nexapos.remembered-shop-id";

export default function LoginPage() {
  const router = useRouter();
  const { login, status } = useAuth();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { shop_id: "", username: "", password: "", remember_shop: false },
  });

  useEffect(() => {
    const remembered = window.localStorage.getItem(REMEMBERED_SHOP_KEY);
    if (remembered) {
      setValue("shop_id", remembered);
      setValue("remember_shop", true);
    }
  }, [setValue]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [router, status]);

  const submit = handleSubmit(async (values) => {
    setGeneralError(null);
    try {
      await login({
        shop_id: values.shop_id,
        username: values.username,
        password: values.password,
      });
      if (values.remember_shop) {
        window.localStorage.setItem(REMEMBERED_SHOP_KEY, values.shop_id);
      } else {
        window.localStorage.removeItem(REMEMBERED_SHOP_KEY);
      }
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          if (field === "shop_id" || field === "username" || field === "password") {
            setError(field, {
              message: Array.isArray(messages) ? messages[0] : messages,
            });
          }
        });
        setGeneralError(
          error.status === 0
            ? error.message
            : "The Shop ID, username, or password is incorrect.",
        );
      } else {
        setGeneralError("NexaPOS cannot reach the server. Try again shortly.");
      }
    }
  });

  if (status === "loading" || status === "authenticated") {
    return <AppLoading message="Checking your secure session…" />;
  }

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(500px,0.7fr)]">
      <section className="surface-grid relative hidden overflow-hidden border-r border-border bg-[#eef4ff] p-10 text-text-primary lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-white shadow-sm">
            <ShoppingCart className="size-6" />
          </span>
          <div>
            <p className="text-xl font-extrabold">NexaPOS</p>
            <p className="text-sm text-text-secondary">Grocery operations · Qatar</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            Modern grocery operations
          </p>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.12] tracking-[-0.035em] xl:text-5xl">
            One clear workspace for every shop day.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-text-secondary">
            Sign in to the role-appropriate workspace for checkout, stock control,
            sales history, and operational reporting.
          </p>
          <div className="mt-9 grid max-w-2xl grid-cols-3 gap-3">
            <div className="rounded-xl border border-blue-200/70 bg-white/80 p-4 shadow-sm"><ReceiptText className="size-5 text-primary" /><p className="mt-3 text-sm font-semibold">Fast checkout</p></div>
            <div className="rounded-xl border border-blue-200/70 bg-white/80 p-4 shadow-sm"><Boxes className="size-5 text-primary" /><p className="mt-3 text-sm font-semibold">Live inventory</p></div>
            <div className="rounded-xl border border-blue-200/70 bg-white/80 p-4 shadow-sm"><ChartNoAxesCombined className="size-5 text-primary" /><p className="mt-3 text-sm font-semibold">Real reports</p></div>
          </div>
        </div>
        <p className="text-sm text-text-muted">
          NexaPOS · Production grocery point of sale
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center p-4 sm:p-8 lg:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-xl bg-primary text-white">
              <ShoppingCart className="size-6" />
            </span>
            <div>
              <p className="text-xl font-extrabold">NexaPOS</p>
              <p className="text-sm text-text-muted">Secure shop access</p>
            </div>
          </div>

          <Card className="p-5 sm:p-8 lg:border-border lg:p-9 lg:shadow-[var(--shadow-card)]">
            <div className="mb-7">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Shop access</p>
              <h1 className="text-[1.75rem] font-bold tracking-[-0.025em]">Welcome back</h1>
              <p className="mt-2 text-text-secondary">
                Sign in as a shop owner or cashier to continue.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5" noValidate>
              {generalError ? <Alert title={generalError} /> : null}
              <FormField
                label="Shop ID"
                htmlFor="shop_id"
                error={errors.shop_id?.message}
                hint="Use the Shop ID provided by your administrator."
              >
                <Input
                  id="shop_id"
                  autoComplete="organization"
                  spellCheck={false}
                  invalid={Boolean(errors.shop_id)}
                  {...register("shop_id")}
                />
              </FormField>
              <FormField
                label="Username"
                htmlFor="username"
                error={errors.username?.message}
              >
                <Input
                  id="username"
                  autoComplete="username"
                  invalid={Boolean(errors.username)}
                  {...register("username")}
                />
              </FormField>
              <FormField
                label="Password"
                htmlFor="password"
                error={errors.password?.message}
              >
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  invalid={Boolean(errors.password)}
                  {...register("password")}
                />
              </FormField>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  className="size-5 rounded border-border-strong accent-primary focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]"
                  {...register("remember_shop")}
                />
                Remember this Shop ID on this device
              </label>
              <Button
                type="submit"
                className="min-h-12 w-full"
                loading={isSubmitting}
              >
                Sign in
              </Button>
              <div className="flex items-center justify-between gap-3 text-sm">
                <Link className="font-semibold text-primary" href="/forgot-password">Forgot password?</Link>
                <Link className="font-semibold text-primary" href="/register-shop">Register a shop</Link>
              </div>
            </form>
          </Card>
          <p className="mt-5 text-center text-xs leading-5 text-text-muted">
            Use the Shop ID and account details provided by your shop owner.
          </p>
        </div>
      </section>
    </main>
  );
}
