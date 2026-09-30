/**
 * The shape the fake customers are kept in — a fixture model, not an API type. Every handler turns
 * a row into the contract's DTOs (`AdminCustomerDto`, `AddressDto`, `TaxProfileDto`, …) on the way
 * out; the rows keep names where the contract has ids, because they are what a person reads.
 */

import type { Schemas } from "@/lib/api/types";

export interface CustomerAddressRow {
  id: string;
  kind: Schemas["AddressKind"];
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string;
  postcode: string;
  isDefault: boolean;
}

export interface TaxProfileRow {
  id: string;
  taxType: Schemas["CustomerType"];
  name: string;
  taxId: string;
  branchType: Schemas["BranchType"];
  branchCode: string;
  /** One line, postcode last. */
  address: string;
  withholdsTax: boolean;
  isDefault: boolean;
}

export interface CustomerRow {
  id: string;
  customerCode: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  customerType: Schemas["CustomerType"];
  companyName: string | null;
  createdVia: Schemas["CreationChannel"];
  ordersCount: number;
  createdAt: string;
  referralCode: string;
  loyalty: { tier: Schemas["LoyaltyTier"]; availablePoints: number; spend12m: string };
  lastOrderAt: string | null;
  birthDate: string | null;
  addresses: CustomerAddressRow[];
  taxProfiles: TaxProfileRow[];
}
