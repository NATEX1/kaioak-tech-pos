-- Align the new-install default with the shop brand. Existing rows are not changed.
ALTER TABLE "AppSetting" ALTER COLUMN "shopName" SET DEFAULT 'KAIOAK TECH';
