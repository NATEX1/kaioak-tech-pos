import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/inventory/product-form";
import { listActiveCategories } from "@/server/services/categories";
import { getProductById } from "@/server/services/products";
import { listActiveSuppliers } from "@/server/services/suppliers";
import { requireAdmin } from "@/server/auth/session";

export const instant = false;

export const metadata: Metadata = {
  title: "แก้ไขสินค้า",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;
  const [product, categories, suppliers] = await Promise.all([
    getProductById({ id: actor.id, role: actor.role }, id),
    listActiveCategories(),
    listActiveSuppliers(),
  ]);

  if (!product) {
    notFound();
  }

  const trackSerialLocked =
    product.stockQty > 0 || product._count.serials > 0;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/inventory/products/${product.id}`}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          กลับรายละเอียดสินค้า
        </Link>
        <h2 className="text-xl font-semibold tracking-tight">แก้ไขสินค้า</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {product.sku} · {product.name}
        </p>
      </div>

      <ProductForm
        mode="edit"
        productId={product.id}
        categories={categories}
        suppliers={suppliers}
        trackSerialLocked={trackSerialLocked}
        initial={{
          name: product.name,
          sku: product.sku,
          categoryId: product.categoryId,
          defaultSupplierId: product.defaultSupplierId ?? "",
          brand: product.brand ?? "",
          model: product.model ?? "",
          description: product.description ?? "",
          costPrice: product.costPrice.toFixed(2),
          salePrice: product.salePrice.toFixed(2),
          reorderLevel: String(product.reorderLevel),
          warrantyMonths: String(product.warrantyMonths),
          trackSerial: product.trackSerial,
        }}
      />
    </div>
  );
}
