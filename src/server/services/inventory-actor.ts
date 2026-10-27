import "server-only";

import type { Role } from "@/generated/prisma/enums";

import { InventoryError } from "@/server/services/inventory-error";

export type InventoryActor = {
  id: string;
  role: Role;
};

export function assertInventoryAdmin(actor: InventoryActor): void {
  if (actor.role !== "ADMIN") {
    throw new InventoryError(
      "FORBIDDEN",
      "คุณไม่มีสิทธิ์จัดการสินค้าและสต๊อก",
    );
  }
}
