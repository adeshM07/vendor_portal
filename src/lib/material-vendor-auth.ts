/** Seeded material vendor phones with backend fixed OTP (local/dev). */
const DEFAULT_TEST_PHONES = Array.from({ length: 5 }, (_, index) =>
  String(9822200001 + index)
);
const DEFAULT_FIXED_OTP = "5678";

function parsePhoneList(raw: string | undefined): string[] {
  if (!raw?.trim()) return DEFAULT_TEST_PHONES;
  return raw
    .split(/[,;\s]+/)
    .map((value) => value.replace(/\D/g, ""))
    .filter((value) => value.length === 10);
}

export const MATERIAL_VENDOR_TEST_PHONES = new Set(
  parsePhoneList(process.env.NEXT_PUBLIC_MATERIAL_VENDOR_OTP_PHONES)
);

export const MATERIAL_VENDOR_FIXED_OTP =
  process.env.NEXT_PUBLIC_MATERIAL_VENDOR_FIXED_OTP?.trim() || DEFAULT_FIXED_OTP;

export const MATERIAL_VENDOR_OTP_LENGTH = MATERIAL_VENDOR_FIXED_OTP.length;

export const RENTAL_VENDOR_FIXED_OTP = "1234";

export const MATERIAL_VENDOR_PHONE_RANGE = "9822200001–9822200005";

export const RENTAL_VENDOR_PHONE_RANGE = "9811100001–9811100010";

export function formatMaterialVendorLoginHint(): string {
  const phones = [...MATERIAL_VENDOR_TEST_PHONES].sort().join(", ");
  return `Use a material supplier phone (${phones}) with OTP ${MATERIAL_VENDOR_FIXED_OTP} after Send OTP.`;
}

export function isMaterialVendorTestPhone(phone: string): boolean {
  return MATERIAL_VENDOR_TEST_PHONES.has(phone.replace(/\D/g, ""));
}

/** Seeded rental vendor phones 9811100001–9811100010 (backend fixed OTP on local/dev). */
export function isRentalVendorTestPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return false;
  const num = Number(digits);
  return num >= 9811100001 && num <= 9811100010;
}

export function otpRetryAfterSeconds(err: {
  code: string;
  details?: { field: string; message: string }[];
}): number | null {
  if (err.code !== "RATE_LIMITED") return null;
  const detail = err.details?.find(
    (item) =>
      item.field === "retry_after_seconds" ||
      item.field.toLowerCase().includes("retry")
  );
  if (!detail?.message) return null;
  const seconds = Number(detail.message);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
