import type { PotluckClaim, PotluckItem } from "@/types";

/** Total units claimed so far (ignored for money requests, which have no fixed quantity). */
export function claimedQuantity(item: PotluckItem): number {
  return item.claims.reduce((sum, c) => sum + c.quantity, 0);
}

/** Total amount pledged so far toward a money-request item. */
export function pledgedAmount(item: PotluckItem): number {
  return item.claims.reduce((sum, c) => sum + (c.contributionAmount ?? 0), 0);
}

/** Non-money items are "covered" once claims meet the quantity needed. Money requests are
 *  open-ended — any number of guests can chip in — so they're never marked fulfilled. */
export function isItemFulfilled(item: PotluckItem): boolean {
  if (item.isMoneyRequest) return false;
  return claimedQuantity(item) >= item.quantityNeeded;
}

export function findMyClaim(item: PotluckItem, attendeeId: string | undefined | null): PotluckClaim | null {
  if (!attendeeId) return null;
  return item.claims.find((c) => c.attendeeId === attendeeId) ?? null;
}
