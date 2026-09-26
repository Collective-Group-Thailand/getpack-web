/**
 * Which fake commerce customer (`../admin/commerce`) a storefront persona is: the one whose
 * orders, RFQs and address book it owns. A module of its own so the store mocks can share it
 * without importing each other in a circle.
 */

import { customers as fakeCustomers } from "../admin/commerce";
import type { MockCustomer } from "./customers";

export function ownerIdOf(customer: MockCustomer): string {
  return customer.ownerIndex === null ? customer.id : fakeCustomers[customer.ownerIndex]!.id;
}
