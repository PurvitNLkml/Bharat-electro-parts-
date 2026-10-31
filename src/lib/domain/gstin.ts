const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** GSTIN: 2 digit state, 10 char PAN, entity, Z, checksum. */
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function gstinChecksum(first14: string): string {
  const body = first14.toUpperCase();
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const code = ALPHABET.indexOf(body[i] ?? "");
    if (code < 0) return "";
    const product = code * ((i % 2) + 1);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36] ?? "";
}

export function isValidGstin(value: string): boolean {
  const gstin = normalizeGstin(value);
  if (!GSTIN_SHAPE.test(gstin)) return false;
  return gstinChecksum(gstin.slice(0, 14)) === gstin[14];
}

export function normalizeMobile(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidIndianMobile(value: string): boolean {
  return /^[6-9][0-9]{9}$/.test(normalizeMobile(value));
}
