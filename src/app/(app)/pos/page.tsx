import type { Metadata } from "next";

import { PosTerminal } from "@/components/pos/pos-terminal";
import { requireUser } from "@/server/auth/session";
import { getPosData } from "@/server/services/pos";

export const instant = false;

export const metadata: Metadata = {
  title: "ขายหน้าร้าน (POS)",
};

export default async function PosPage() {
  const actor = await requireUser();
  const data = await getPosData({ id: actor.id, role: actor.role });

  return <PosTerminal data={data} currentUserName={actor.name} />;
}
