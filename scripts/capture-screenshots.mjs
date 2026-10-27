// Captures PNG screenshots of the main app pages (desktop + mobile).
// Usage: node scripts/capture-screenshots.mjs
// Requires the dev/prod server running on BASE_URL and the seeded admin account.
import fs from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
import puppeteer from "puppeteer-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.resolve("screenshot");
const EXECUTABLE =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PAGES = [
  { slug: "login", path: "/login", noAuth: true },
  { slug: "dashboard", path: "/" },
  { slug: "bills", path: "/bills" },
  { slug: "commissions", path: "/commissions" },
  { slug: "commissions-payouts", path: "/commissions/payouts" },
  { slug: "commissions-rules", path: "/commissions/rules" },
  { slug: "customers", path: "/customers" },
  { slug: "inventory", path: "/inventory" },
  { slug: "inventory-products", path: "/inventory/products" },
  { slug: "inventory-low-stock", path: "/inventory/low-stock" },
  { slug: "inventory-receipts", path: "/inventory/receipts" },
  { slug: "inventory-stock", path: "/inventory/stock" },
  { slug: "inventory-import", path: "/inventory/import" },
  { slug: "inventory-categories", path: "/inventory/categories" },
  { slug: "inventory-suppliers", path: "/inventory/suppliers" },
  { slug: "warranty", path: "/warranty" },
  { slug: "reports", path: "/reports" },
  { slug: "audit-logs", path: "/audit-logs" },
  { slug: "settings-users", path: "/settings/users" },
  { slug: "settings-shop", path: "/settings/shop" },
  { slug: "profile", path: "/profile" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2 },
];

const STABILIZE_CSS = `
  nextjs-portal, [data-nextjs-toast], [data-next-badge] { display: none !important; }
  *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
`;

async function waitForIdle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 400)));
      }),
  );
}

async function capture(page, filePath) {
  await page.addStyleTag({ content: STABILIZE_CSS });
  await waitForIdle(page);
  await page.screenshot({ path: filePath, fullPage: true });
  const { size } = await fs.stat(filePath);
  console.log(`  ✓ ${path.relative(process.cwd(), filePath)} (${(size / 1024).toFixed(0)} KB)`);
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in .env");
  }

  const browser = await puppeteer.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb"],
  });

  try {
    for (const viewport of VIEWPORTS) {
      const dir = path.join(OUT_DIR, viewport.name);
      await fs.mkdir(dir, { recursive: true });

      const page = await browser.newPage();
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
      });

      let index = 1;
      for (const item of PAGES) {
        const fileName = `${String(index).padStart(2, "0")}-${item.slug}.png`;
        index += 1;

        // The login page is captured anonymously in a clean context.
        if (item.noAuth) {
          const anon = await browser.createBrowserContext();
          const anonPage = await anon.newPage();
          await anonPage.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.deviceScaleFactor,
          });
          await anonPage.goto(`${BASE_URL}${item.path}`, {
            waitUntil: "networkidle2",
            timeout: 120_000,
          });
          await capture(anonPage, path.join(dir, fileName));
          await anon.close();
          continue;
        }

        // Log in once per viewport, then reuse the session.
        if (!page.__loggedIn) {
          await page.goto(`${BASE_URL}/login`, {
            waitUntil: "networkidle2",
            timeout: 120_000,
          });
          // The browser keeps cookies between viewports, so the session may already be valid.
          if (new URL(page.url()).pathname === "/login") {
            await page.type("#email", email, { delay: 10 });
            await page.type("#password", password, { delay: 10 });
            await Promise.all([
              page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120_000 }),
              page.click('form button[type="submit"]'),
            ]);
            if (new URL(page.url()).pathname === "/login") {
              throw new Error("Login failed — check SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD");
            }
          }
          page.__loggedIn = true;
          console.log(`Logged in as ${email} (${viewport.name})`);
        }

        await page.goto(`${BASE_URL}${item.path}`, {
          waitUntil: "networkidle2",
          timeout: 120_000,
        });
        const status = page.url();
        if (status.includes("/login") || status.includes("/forbidden")) {
          throw new Error(`Unexpected redirect for ${item.path}: ${status}`);
        }
        await capture(page, path.join(dir, fileName));
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\nDone → ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
