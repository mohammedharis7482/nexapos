import { formatQuantity } from "@/lib/formatters";
import type { SaleItem } from "@/types/billing";
import type { ProductPacket, ProductUnit } from "@/types/product";

/**
 * Label for a packet size, in the product's own unit.
 *
 * Sizes are stored in the base unit (a 250 g packet of a KG product is
 * "0.250"), so this is purely presentational - it never converts anything
 * the server would have to convert back.
 */
export function packetLabel(size: string, unit: ProductUnit): string {
  return `${formatQuantity(size)} ${unit.toLowerCase()}`;
}

/**
 * How a cart line describes the way it was priced.
 *
 * Reads the line's own snapshot rather than the live product, so a receipt
 * reprint says what was actually sold even if the packet was withdrawn or
 * the product later switched pricing mode.
 */
export function saleItemModeLabel(item: SaleItem): string | null {
  if (item.pricing_mode === "PACKET" && item.packet_size) {
    return `${packetLabel(item.packet_size, item.product.unit)} packet`;
  }
  if (item.pricing_mode === "LOOSE") return "loose";
  return null;
}

/**
 * Full cart/receipt description, e.g. "Rice (500 g packet)" or
 * "Rice - 0.750 kg loose". Standard lines keep their plain product name.
 */
export function saleItemDescription(item: SaleItem): string {
  if (item.pricing_mode === "PACKET" && item.packet_size) {
    return `${item.product.name} (${packetLabel(item.packet_size, item.product.unit)} packet)`;
  }
  if (item.pricing_mode === "LOOSE") {
    return `${item.product.name} - ${packetLabel(item.quantity, item.product.unit)} loose`;
  }
  return item.product.name;
}

/**
 * Stock a packet selection would consume, in the product's own unit.
 *
 * Mirrors the server's quantity x packet size, so the cashier is warned
 * before a request that the server would reject. The server stays
 * authoritative - this only avoids a pointless round trip.
 */
export function packetStockDraw(packet: ProductPacket, count: string): number {
  // A blank count is missing input, not zero - Number("") would say 0 and
  // quietly report a draw of nothing.
  if (!count.trim()) return Number.NaN;
  const numeric = Number(count);
  if (!Number.isFinite(numeric)) return Number.NaN;
  return numeric * Number(packet.size);
}
