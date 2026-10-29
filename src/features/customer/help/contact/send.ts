import { browserApi } from "@/lib/api/browser";
import type { Schemas } from "@/lib/api/types";

export type Ticket = Schemas["SupportTicketDto"];
export type ContactBody = Schemas["SupportContactDto"];
export type TicketStatus = Schemas["SupportTicketStatusDto"];

/** A fresh idempotency key per attempt (the API refuses a reused key with a different body). */
export const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

/** The field robots fill and people never see (pack hard rule 7, spam protection beside the API's rate limit). */
export const HONEYPOT = "company_website";

/** Whether the hidden honeypot field of a form was filled — then nothing is sent. */
export function trapped(form: HTMLFormElement | null): boolean {
  const field = form?.elements.namedItem(HONEYPOT);
  return field instanceof HTMLInputElement && field.value.trim() !== "";
}

/** Moves focus to the first invalid control once the errors have rendered (pack hard rule 7). */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  window.requestAnimationFrame(() => {
    const first = form?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
    first?.focus();
  });
}

/**
 * Every form on /contact, /business (#sales) and /partner-with-us (#apply) is one contact ticket
 * (`store.support.contact`, D-221 / D-458): the reference is the API's `CS-…` for every topic (D-440), the topic
 * and the intent's details travel with it and route it to the right team.
 */
export async function sendContact(body: ContactBody, key: string): Promise<Ticket> {
  const { data } = await browserApi().POST("/v1/store/support/actions/contact", {
    params: { header: { "Idempotency-Key": key } },
    body,
  });
  return data!;
}

export const PHONE = /^0\d{8,9}$/;
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
