import { expect, type Page } from "@playwright/test";

import { HOSTS } from "../../playwright.config";
import { gotoHydrated, MOCK_OTP } from "./session";

/** The mock persona `agent` (mocks/store/agent.ts): an approved freelance agent. */
export const AGENT_PHONE = "0861234567";
/** The mock persona `agentended`: an agent whose agreement has ended (statements and 50 ทวิ only). */
export const ENDED_AGENT_PHONE = "0861234568";

/** Signs in on getpack Agent's own sign-in page (D-467) and lands on `path` there. */
export async function signInToAgentZone(page: Page, path = "/", phone = AGENT_PHONE): Promise<void> {
  await gotoHydrated(page, `${HOSTS.agent}/sign-in?returnTo=${encodeURIComponent(path)}`);
  await expect(page.getByLabel("เบอร์มือถือ")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("เบอร์มือถือ").fill(phone);
  await page.getByRole("button", { name: "ขอรหัส OTP" }).click();
  await page.getByLabel("รหัส OTP").fill(MOCK_OTP.code);
  const landed = new RegExp(`^${HOSTS.agent}${path.replace(/[?]/g, "\\?")}$`);
  await expect(page).toHaveURL(landed, { timeout: 20_000 });
  await page.locator("html[data-hydrated]").waitFor({ timeout: 30_000 });
}
