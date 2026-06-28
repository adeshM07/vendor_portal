import {
  isMaterialVendorTestPhone,
  isRentalVendorTestPhone,
} from "@/lib/material-vendor-auth";

export type VendorType = "rental" | "material";

export function getVendorTypeFromPhone(phone: string): VendorType | null {
  const digits = phone.replace(/\D/g, "");
  if (isRentalVendorTestPhone(digits)) return "rental";
  if (isMaterialVendorTestPhone(digits)) return "material";
  return null;
}

export function isRentalVendorPhone(phone: string): boolean {
  return getVendorTypeFromPhone(phone) === "rental";
}

export function isMaterialVendorPhone(phone: string): boolean {
  return getVendorTypeFromPhone(phone) === "material";
}
