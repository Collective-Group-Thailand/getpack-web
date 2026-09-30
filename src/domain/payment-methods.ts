import type { Schemas } from "@/lib/api/types";

export type PaymentMethod = Schemas["PaymentMethod"];

/**
 * The ways a customer can pay online at launch (D-110): PromptPay QR, card and online banking
 * through 2C2P, and a transfer with a slip (D-061). The contract's `PaymentMethod` also names card
 * instalments and SCB direct debit, which are R2 (D-111), and store credit and a company's credit
 * term, which are not picked at the payment step.
 *
 * CONTRACT-GAP store.checkout — the published preview does not say which methods an order may use
 * or what each costs, so the list is the launch scope; the API still refuses one it does not allow,
 * and the page shows its problem.
 */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethod[] = [
  "scb_qr",
  "card_2c2p",
  "online_banking_2c2p",
  "bank_transfer_slip",
];
