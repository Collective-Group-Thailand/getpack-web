/** A recipient's address on one line, as the API gave its parts (D-142: address, province, postcode). */
export const addressLine = (destination: { address: string; province: string; postcode: string }) =>
  [destination.address, destination.province, destination.postcode].filter(Boolean).join(" ");
