import type { Schemas } from "@/lib/api/types";

export type PaymentMethod = Schemas["PaymentMethod"];

/**
 * The ways a customer can pay online at launch (D-110): PromptPay QR, card and online banking
 * through 2C2P, and a transfer with a slip (D-061). The contract's `PaymentMethod` also names card
 * instalments and SCB direct debit, which are R2 (D-111), and store credit and a company's credit
 * term, which are not picked at the payment step.
 *
 * The checkout preview says which methods are offered now (`paymentMethods[].available`, D-176,
 * no surcharge); the storefront offers the ones of those it has a payment page for, in this order.
 */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethod[] = [
  "scb_qr",
  "card_2c2p",
  "online_banking_2c2p",
  "bank_transfer_slip",
];
