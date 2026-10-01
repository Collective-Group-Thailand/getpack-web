/** A recipient's address on one line, as the API gave its parts (D-142: address, province, postcode). */
export const addressLine = (destination: {
  line1: string;
  line2?: string | null;
  province: string;
  postcode: string;
}) => [destination.line1, destination.line2, destination.province, destination.postcode].filter(Boolean).join(" ");
