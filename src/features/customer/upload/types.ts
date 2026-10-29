/** An own-file product the upload page offers (instant price path; `/studio/upload` lists only these, DECISIONS-STAGE-A §1). */
export interface UploadProduct {
  slug: string;
  name: string;
  /** The listing's starting price (decimal string from the API), or null. */
  startingPrice: string | null;
  moq: number | null;
}
