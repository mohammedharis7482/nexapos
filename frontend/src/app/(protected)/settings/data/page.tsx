import Link from "next/link";
import { Download, Upload } from "lucide-react";

import { Breadcrumbs, ModuleNavigation, settingsNavigation } from "@/components/layout/module-navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/display";

const exportBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/+$/, "");
const actions = [
  { href: "/products/import", label: "Import Products", description: "Validate and import a CSV product catalogue.", icon: Upload, external: false },
  ...["products", "inventory", "sales", "shifts"].map((name) => ({
    href: `${exportBase}/exports/${name}.csv`,
    label: `Export ${name[0].toUpperCase()}${name.slice(1)}`,
    description: `Download the current ${name} data as CSV.`,
    icon: Download,
    external: true,
  })),
];

export default function DataManagementPage() {
  return (
    <div className="page-stack">
      <Breadcrumbs items={[{ label: "Settings", href: "/settings" }, { label: "Data Management" }]} />
      <ModuleNavigation label="Settings sections" items={settingsNavigation} />
      <PageHeader eyebrow="Administration" title="Data Management" description="Use the import and export tools already available in NexaPOS." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map(({ href, label, description, icon: Icon, external }) => {
          const content = (
            <Card className="h-full p-5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-bold">{label}</h2>
              <p className="mt-1 text-sm leading-6 text-foreground-muted">{description}</p>
            </Card>
          );
          const className = "rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]";
          return external
            ? <a key={href} href={href} className={className}>{content}</a>
            : <Link key={href} href={href} className={className}>{content}</Link>;
        })}
      </div>
    </div>
  );
}
