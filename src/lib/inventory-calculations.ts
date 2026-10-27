import { Decimal, roundMoney } from "@/lib/money";

export function calculateLineTotal(
  quantity: number,
  unitCost: Decimal.Value,
): Decimal {
  return roundMoney(new Decimal(unitCost).times(quantity));
}

/**
 * Weighted average cost for stock receipts. When the old stock is zero the
 * incoming cost becomes the new average. When stock is already zero the old
 * cost is irrelevant.
 */
export function calculateWeightedAverageCost(
  previousQuantity: number,
  previousCost: Decimal.Value,
  incomingQuantity: number,
  incomingCost: Decimal.Value,
): Decimal {
  if (previousQuantity < 0 || incomingQuantity <= 0) {
    throw new Error("Stock quantities must be non-negative.");
  }

  const newQuantity = previousQuantity + incomingQuantity;

  if (newQuantity === 0) {
    return roundMoney(previousCost);
  }

  const previousValue = new Decimal(previousCost).times(previousQuantity);
  const incomingValue = new Decimal(incomingCost).times(incomingQuantity);

  return roundMoney(previousValue.plus(incomingValue).dividedBy(newQuantity));
}

export function isLowStock(stockQty: number, reorderLevel: number): boolean {
  return stockQty <= reorderLevel;
}

export function suggestedReorderQuantity(
  stockQty: number,
  reorderLevel: number,
): number {
  const target = Math.max(reorderLevel * 2, reorderLevel + 1);
  return Math.max(0, target - stockQty);
}

export function formatSku(categoryCode: string, sequence: number): string {
  return `${categoryCode.toUpperCase()}-${String(sequence).padStart(4, "0")}`;
}
