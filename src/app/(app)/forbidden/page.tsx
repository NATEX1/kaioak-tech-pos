import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";

export const instant = false;

export const metadata: Metadata = {
  title: "ไม่มีสิทธิ์เข้าถึง",
};

export default async function ForbiddenPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" aria-hidden />
          </div>
          <CardTitle className="pt-3 text-xl">ไม่มีสิทธิ์เข้าถึงหน้านี้</CardTitle>
          <CardDescription>
            บัญชีของคุณไม่มีสิทธิ์ดำเนินการนี้
            หากคิดว่าเป็นความผิดพลาดกรุณาติดต่อผู้ดูแลระบบ
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href="/" className={cn(buttonVariants(), "h-9")}>
            <ArrowLeft aria-hidden />
            กลับหน้าภาพรวม
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
