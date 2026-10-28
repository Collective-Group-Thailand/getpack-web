/** The flute a material is made on, from its attributes (`flute`) or its name ("ลอน B"); null if neither says. */
export function fluteOf(option: {
  nameTh: string;
  nameEn: string;
  attributes: Record<string, unknown>;
}): string | null {
  const attribute = typeof option.attributes.flute === "string" ? option.attributes.flute.toUpperCase() : "";
  const fromAttribute = /(BC|EB|[ABCEF])$/.exec(attribute)?.[1];
  if (fromAttribute) return fromAttribute;
  const fromName = /(?:ลอน|flute)\s*(BC|EB|[ABCEF])\b/i.exec(`${option.nameTh} ${option.nameEn}`)?.[1];
  return fromName ? fromName.toUpperCase() : null;
}
