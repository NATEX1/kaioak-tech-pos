"use server";

import { requireUser } from "@/server/auth/session";
import {
  checkClaimEligibility,
  lookupWarrantyBySerial,
  type ClaimEligibilityInput,
  type ClaimEligibilityResult,
  type SerialWarrantyLookupResult,
} from "@/server/services/warranty";

export async function checkClaimEligibilityAction(
  input: ClaimEligibilityInput,
): Promise<ClaimEligibilityResult> {
  const user = await requireUser();
  return checkClaimEligibility({ id: user.id, role: user.role }, input);
}

export async function lookupSerialWarrantyAction(
  serialNumber: string,
): Promise<SerialWarrantyLookupResult> {
  const user = await requireUser();
  return lookupWarrantyBySerial({ id: user.id, role: user.role }, serialNumber);
}
