import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/session";
import {
  checkClaimEligibility,
  lookupWarrantyBySerial,
} from "@/server/services/warranty";

export async function GET(request: Request) {
  const actor = await getCurrentUser();

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const serial = searchParams.get("serial")?.trim() || "";
  const customerId = searchParams.get("customerId")?.trim() || "";
  const productId = searchParams.get("productId")?.trim() || "";
  const mode = searchParams.get("mode")?.trim() || "";

  const actorRef = { id: actor.id, role: actor.role };

  // If mode === "claim" or customerId is provided, run claim eligibility check
  if (mode === "claim" || customerId || (productId && !serial)) {
    const eligibility = await checkClaimEligibility(actorRef, {
      customerId: customerId || null,
      productId: productId || null,
      serialNumber: serial || null,
    });
    return NextResponse.json(eligibility);
  }

  // Otherwise, default to reverse serial lookup
  if (serial) {
    const lookup = await lookupWarrantyBySerial(actorRef, serial);
    return NextResponse.json(lookup);
  }

  return NextResponse.json(
    { error: "Please specify serial, customerId or productId parameter" },
    { status: 400 },
  );
}
