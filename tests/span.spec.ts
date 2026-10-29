import { test, expect, type Page } from '@playwright/test';

/**
 * Station 05 · Projections across readings (beta).
 *
 * The scope is the URL: /span, or /span/<id>/<id>/… (src/lib/scope.ts
 * `spanPath`). What these specs pin is the part that is easy to break without
 * a type error — the address bar and the picker agreeing with each other.
 *
 * NOT in READ_ONLY (playwright.config.ts: "it goes in `write` unless you can
 * point at the line that proves it writes nothing"). Opening a scope's board
 * can create that scope's projection row, and nothing here proves otherwise.
 * Do not add this file to READ_ONLY without that proof.
 *
 * UNRUN when written: the machine it was written on had no database, and
 * these need the seeded `ci` branch (see playwright.config.ts). It was typed
 * and linted, not executed.
 */

test.use({ storageState: 'playwright/.auth/testa.json' });

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

async function openSpan(page: Page, path = '/span') {
  await page.goto(path);
  await expect(page.getByText('Loading your loom...')).toHaveCount(0, { timeout: 20000 });
}

/** The picker's buttons — the only `.chip`s carrying aria-pressed on this page. */
const pickers = (page: Page) => page.locator('main button.chip[aria-pressed]');

test('the station is on the journey bar, labelled beta, and is the active one', async ({ page }) => {
  await openSpan(page);
  const nav = page.locator('nav[aria-label="The journey"]');
  const here = nav.getByRole('link', { name: /Projections across readings \(beta\)/ });
  await expect(here).toBeVisible({ timeout: 15000 });
  // A station link is marked by the `active` class (JourneyNav: `active === key`),
  // the same marker reading-search.spec.ts asserts on `nav button.station.active`.
  // Only the staff group sets aria-current; the stations do not.
  await expect(here).toHaveClass(/\bactive\b/);
});

test('choosing two readings writes both ids to the address, and a reload keeps them', async ({ page }) => {
  test.setTimeout(90_000);
  await openSpan(page);
  await expect(pickers(page).nth(1)).toBeVisible({ timeout: 15000 });

  await pickers(page).nth(0).click();
  await pickers(page).nth(1).click();

  await expect(page).toHaveURL(new RegExp(`/span/${UUID}/${UUID}$`));
  await expect(pickers(page).nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(pickers(page).nth(1)).toHaveAttribute('aria-pressed', 'true');

  const url = page.url();
  await page.reload();
  await expect(page.getByText('Loading your loom...')).toHaveCount(0, { timeout: 20000 });
  expect(page.url()).toBe(url);
  await expect(page.locator('main button.chip[aria-pressed="true"]')).toHaveCount(2);
});

test('the same two readings in the other order are one bookmark', async ({ page }) => {
  test.setTimeout(90_000);
  await openSpan(page);
  await expect(pickers(page).nth(1)).toBeVisible({ timeout: 15000 });
  await pickers(page).nth(0).click();
  await pickers(page).nth(1).click();
  await expect(page).toHaveURL(new RegExp(`/span/${UUID}/${UUID}$`));

  const [, a, b] = new URL(page.url()).pathname.match(new RegExp(`/span/(${UUID})/(${UUID})$`))!;
  // scopeOf sorts, so whichever order was typed, the address is a-then-b.
  const sorted = [a, b].sort();
  await openSpan(page, `/span/${sorted[1]}/${sorted[0]}`);
  await expect(page).toHaveURL(new RegExp(`/span/${sorted[0]}/${sorted[1]}$`), { timeout: 15000 });
});

test('an id that is not on the shelf is dropped from a bookmark, not trusted', async ({ page }) => {
  await openSpan(page, '/span/00000000-0000-4000-8000-000000000000');
  await expect(page).toHaveURL(/\/span$/, { timeout: 15000 });
  await expect(page.locator('main button.chip[aria-pressed="true"]')).toHaveCount(0);
});

test('with nothing chosen there is no board to sort on', async ({ page }) => {
  await openSpan(page);
  await expect(page.getByText('pick at least one')).toBeVisible({ timeout: 15000 });
  // The Knowledge Graph's own switcher is the board's mark; absent until a reading is chosen.
  await expect(page.locator('#mapSwitcher')).toHaveCount(0);
});
