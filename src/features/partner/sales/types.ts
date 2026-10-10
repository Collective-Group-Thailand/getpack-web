/** What the E4 forms pick from (`salesPickers`, read on the server). */
export interface SalesPickers {
  customers: {
    id: string;
    code: string;
    name: string;
    paymentTermDays: number;
    address: string | null;
    salespersonId: string | null;
  }[];
  people: { id: string; name: string; roles: string[] }[];
  items: { id: string; sku: string; name: string; baseUnit: string; onHand: string; available: string }[];
  warehouses: { id: string; code: string; name: string; isDefault: boolean }[];
}
