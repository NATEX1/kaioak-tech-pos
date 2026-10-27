const AUDIT_ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "เข้าสู่ระบบสำเร็จ",
  AUTH_LOGIN_FAILED: "เข้าสู่ระบบไม่สำเร็จ",
  AUTH_LOGIN_BLOCKED: "ระงับการเข้าสู่ระบบชั่วคราว",
  AUTH_LOGOUT: "ออกจากระบบ",

  USER_CREATED: "สร้างผู้ใช้",
  USER_UPDATED: "แก้ไขผู้ใช้",
  USER_DEACTIVATED: "ปิดใช้ผู้ใช้",
  USER_REACTIVATED: "เปิดใช้ผู้ใช้",
  USER_PASSWORD_RESET: "รีเซตรหัสผ่านผู้ใช้",
  USER_PASSWORD_CHANGED: "เปลี่ยนรหัสผ่าน",

  BILL_CREATED: "สร้างบิล",
  BILL_UPDATED: "แก้ไขบิล",
  BILL_SUBMITTED: "ส่งขออนุมัติ",
  BILL_APPROVED: "อนุมัติบิล",
  BILL_REJECTED: "ตีกลับบิล",
  BILL_PAID: "ชำระเงินแล้ว",
  BILL_VOIDED: "ยกเลิกบิล",

  CUSTOMER_CREATED: "สร้างลูกค้า",
  CUSTOMER_UPDATED: "แก้ไขลูกค้า",
  CUSTOMER_ARCHIVED: "เก็บลูกค้าถาวร",
  CUSTOMER_RESTORED: "กู้คืนลูกค้า",

  PRODUCT_CREATED: "สร้างสินค้า",
  PRODUCT_UPDATED: "แก้ไขสินค้า",
  PRODUCT_ARCHIVED: "เก็บสินค้าถาวร",
  PRODUCT_RESTORED: "กู้คืนสินค้า",
  PRODUCT_BARCODE_ADDED: "เพิ่มบาร์โค้ดสินค้า",
  PRODUCT_BARCODE_REMOVED: "ลบบาร์โค้ดสินค้า",
  PRODUCT_BARCODE_PRIMARY_CHANGED: "เปลี่ยนบาร์โค้ดหลัก",
  PRODUCTS_IMPORTED: "นำเข้าสินค้าจาก CSV",

  CATEGORY_CREATED: "สร้างหมวดหมู่",
  CATEGORY_UPDATED: "แก้ไขหมวดหมู่",
  CATEGORY_ARCHIVED: "เก็บหมวดหมู่ถาวร",
  CATEGORY_RESTORED: "กู้คืนหมวดหมู่",

  SUPPLIER_CREATED: "สร้างผู้จัดจำหน่าย",
  SUPPLIER_UPDATED: "แก้ไขผู้จัดจำหน่าย",
  SUPPLIER_ARCHIVED: "เก็บผู้จัดจำหน่ายถาวร",
  SUPPLIER_RESTORED: "กู้คืนผู้จัดจำหน่าย",

  GOODS_RECEIPT_CREATED: "รับสินค้าเข้า",
  STOCK_ADJUSTED: "ปรับปรุงสต๊อก",

  COMMISSION_RULE_CREATED: "สร้างกติกาค่าคอม",
  COMMISSION_RULE_UPDATED: "แก้ไขกติกาค่าคอม",
  COMMISSION_RULE_ACTIVATED: "เปิดกติกาค่าคอม",
  COMMISSION_RULE_DEACTIVATED: "ปิดกติกาค่าคอม",
  COMMISSION_EARNED: "บันทึกค่าคอม",
  COMMISSION_REVERSED: "กลับรายการค่าคอม",
  COMMISSION_PAYOUT_CREATED: "สร้างรอบจ่ายค่าคอม",

  SETTINGS_UPDATED: "แก้ไขข้อมูลร้าน",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditActionTone(action: string): string {
  if (
    action.includes("DELETE") ||
    action.includes("VOID") ||
    action.includes("REVERSED") ||
    action.includes("ARCHIVED") ||
    action.includes("BLOCKED")
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (
    action.includes("CREATE") ||
    action.includes("REGISTER") ||
    action.includes("IMPORTED") ||
    action.includes("RESTORED") ||
    action.includes("ADDED")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (
    action.includes("UPDATE") ||
    action.includes("EDIT") ||
    action.includes("APPROVE") ||
    action.includes("PAID") ||
    action.includes("CHANGED") ||
    action.includes("ADJUSTED")
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (action.includes("LOGIN") || action.includes("LOGOUT")) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}
