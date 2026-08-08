"use client";

import { saleItemQuantityLabel } from "@/lib/pricing";
import { secondaryNameDir } from "@/lib/rtl";
import type { ReceiptData } from "@/types/sales";

export function Receipt({ data }: { data: ReceiptData }) {
  const { shop, sale } = data;
  return (
    <article className="print-receipt mx-auto w-full max-w-[360px] border border-slate-200 bg-white p-5 font-mono text-[12px] leading-5 text-black shadow-sm">
      <header className="text-center">
        <h1 className="text-lg font-bold">{shop.name}</h1>
        {shop.legal_name ? <p>{shop.legal_name}</p> : null}
        <p>{shop.address}</p>
        <p>{shop.phone}</p>
        {shop.tax_registration_number ? <p>Tax No: {shop.tax_registration_number}</p> : null}
      </header>
      <div className="my-4 border-y border-dashed border-black py-3">
        <p>Sale: {sale.sale_number}</p>
        <p>Date: {new Intl.DateTimeFormat("en-QA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sale.completed_at))}</p>
        <p>Cashier: {sale.completed_by.full_name}</p>
      </div>
      <div className="space-y-3">
        {sale.items.map((item) => (
          <div key={item.id}>
            <p className="font-bold">{item.product.name}</p>
            {/* Snapshotted at sale time, so a reprint shows the name as sold.
                dir carries RTL for Arabic/Urdu; nothing else on the receipt
                changes direction. */}
            {item.product.secondary_name ? (
              <p dir={secondaryNameDir(item.product.secondary_name)}>
                {item.product.secondary_name}
              </p>
            ) : null}
            {/* A packet line counts packets, not units - printing
                `quantity` against product.unit would claim two 250 g packets
                were 2 kg. saleItemQuantityLabel states what was actually
                sold. */}
            <div className="flex justify-between">
              <span>{saleItemQuantityLabel(item)} × {item.unit_price}</span>
              <span>{item.line_total}</span>
            </div>
          </div>
        ))}
      </div>
      <dl className="mt-4 space-y-1 border-y border-dashed border-black py-3">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>QAR {sale.subtotal}</dd></div>
        <div className="flex justify-between"><dt>Tax</dt><dd>QAR {sale.tax_total}</dd></div>
        {Number(sale.discount_total) > 0 ? (
          <div className="flex justify-between"><dt>Discount{sale.discount_type === "PERCENTAGE" ? ` (${sale.discount_value}%)` : ""}</dt><dd>-QAR {sale.discount_total}</dd></div>
        ) : null}
        <div className="flex justify-between text-sm font-bold"><dt>Total</dt><dd>QAR {sale.grand_total}</dd></div>
      </dl>
      <div className="mt-3 space-y-1">
        {sale.payments.map((payment) => (
          <div className="flex justify-between" key={payment.id}><span>{payment.method}</span><span>QAR {payment.amount}</span></div>
        ))}
        <div className="flex justify-between"><span>Received</span><span>QAR {sale.amount_received}</span></div>
        <div className="flex justify-between"><span>Change</span><span>QAR {sale.change_due}</span></div>
      </div>
      {shop.receipt_footer ? <footer className="mt-5 border-t border-dashed border-black pt-4 text-center">{shop.receipt_footer}</footer> : null}
    </article>
  );
}
