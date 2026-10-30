import { test, expect } from "@playwright/test"
import { isDeletePost, openReading } from "./helpers"

test.use({ storageState: "playwright/.auth/testa.json" })

/**
 * The warp's + coins a concept on 02 · Linking. The same card has to be able
 * to take that concept back — a misspelling, or a name that was not the idea —
 * without sending the student to 04 to find a row they just made here.
 *
 * The dialog and the refusal are Vocabulary's (`useRemoveConcept`): this test
 * only checks that the door on the warp actually deletes.
 */
test("a concept coined on the warp can be removed there", async ({ page }) => {
  test.setTimeout(90_000)
  const name = `warp remove ${Date.now().toString().slice(-6)}`
  // 900 tall, not Desktop Chrome's 720. At 720 the warp's own scroll box is
  // 118px high and a new concept sorts last, so its "remove concept" ends up
  // at 692–703px while the fixed footer starts at 686px: the footer intercepts
  // the click and Playwright retries until the test times out (call log:
  // `<span class="footid"> from <footer> subtree intercepts pointer events`).
  // Measured 2026-10-29 on the ci database, 1280 wide: at 900 the button is at
  // 829–840px and the footer starts at 866px. That the button is reachable at
  // 720 at all is a question about the layout, not about this test.
  await page.setViewportSize({ width: 1280, height: 900 })
  await openReading(page, "Object Worlds")
  await page.locator("nav button.station", { hasText: "Linking" }).first().click()

  const warp = page.locator("#warp")
  await warp.getByRole("button", { name: "Add a concept before you have found evidence in the reading" }).click()
  await warp.getByPlaceholder("e.g. boundary objects").fill(name)
  await warp.getByRole("button", { name: "add concept to vocabulary" }).click()

  const row = warp.locator(".crow", { has: page.locator(".clabel", { hasText: name }) })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.locator(".lhead").click()
  const deleted = page.waitForResponse((r) => isDeletePost(r.request()))
  await row.getByRole("button", { name: "remove concept" }).click()
  await page.getByRole("button", { name: "Delete concept" }).click()
  await deleted
  await expect(row).toHaveCount(0)
})
