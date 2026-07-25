import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { MoneyDisplay } from "@/components/ui/display";
import { PaymentMethodBadge } from "@/components/ui/status";
import { formatDashboardSaleReference, formatDashboardSaleTime } from "@/lib/dashboard-formatters";
import type { RecentSale } from "@/types/dashboard";

function PaymentBadges({ methods }: { methods: RecentSale["payment_methods"] }) {
  return <span className="flex flex-wrap justify-end gap-1">{methods.map((method) => <PaymentMethodBadge key={method} method={method} />)}</span>;
}

export function DashboardTransactionRow({
  sale,
  owner,
  timezone,
}: {
  sale: RecentSale;
  owner: boolean;
  timezone: string;
}) {
  const reference = formatDashboardSaleReference(sale.sale_number);
  const time = formatDashboardSaleTime(sale.completed_at, timezone);
  const itemLabel = `${sale.item_count} ${sale.item_count === 1 ? "item" : "items"}`;
  return (
    <li>
      <Link
        href={`/sales/${sale.id}`}
        title={`${sale.sale_number} · ${sale.completed_at}`}
        aria-label={`Open sale ${sale.sale_number}, ${time}, ${itemLabel}, total QAR ${Number(sale.grand_total).toFixed(2)}`}
        className="group grid min-h-18 grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-3 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-hover focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] min-[430px]:grid-cols-[minmax(0,1fr)_auto_minmax(6.5rem,auto)_1.25rem] min-[430px]:gap-x-4"
      >
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-sm font-semibold text-text-primary group-hover:text-primary">{reference}</span>
          <span className="mt-1 block truncate whitespace-nowrap text-xs text-text-muted">
            <time dateTime={sale.completed_at}>{time}</time>
            {owner ? <> · {sale.cashier_name}</> : null}
            <> · {itemLabel}</>
          </span>
          <span className="mt-2 flex min-[430px]:hidden"><PaymentBadges methods={sale.payment_methods} /></span>
        </span>
        <span className="hidden min-[430px]:block"><PaymentBadges methods={sale.payment_methods} /></span>
        <MoneyDisplay value={sale.grand_total} className="justify-self-end text-sm font-semibold text-text-primary" />
        <ChevronRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function DashboardTransactionList({
  sales,
  owner,
  timezone,
}: {
  sales: RecentSale[];
  owner: boolean;
  timezone: string;
}) {
  return (
    <ul className="divide-y divide-border" data-testid="dashboard-transaction-list">
      {sales.map((sale) => <DashboardTransactionRow key={sale.id} sale={sale} owner={owner} timezone={timezone} />)}
    </ul>
  );
}
