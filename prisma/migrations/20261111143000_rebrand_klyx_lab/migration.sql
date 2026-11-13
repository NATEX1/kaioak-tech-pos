-- Rebrand the default shop identity from KAIOAK TECH to KLYX LAB.
ALTER TABLE "AppSetting" ALTER COLUMN "shopName" SET DEFAULT 'KLYX LAB';

UPDATE "AppSetting"
SET
  "shopName" = 'KLYX LAB',
  "logoUrl" = '/brand/klyx-lab-logo.webp',
  "email" = CASE
    WHEN "email" = 'contact@kaioak.local' THEN 'contact@klyxlab.local'
    ELSE "email"
  END,
  "lineId" = CASE
    WHEN "lineId" = '@kaioak' THEN '@klyxlab'
    ELSE "lineId"
  END,
  "receiptFooter" = replace("receiptFooter", 'KAIOAK TECH', 'KLYX LAB')
WHERE "id" = 'main';

UPDATE "User"
SET "name" = replace("name", 'KAIOAK TECH', 'KLYX LAB')
WHERE "name" LIKE '%KAIOAK TECH%';
