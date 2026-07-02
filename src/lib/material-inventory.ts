import {
  MATERIAL_API_BASE_URL,
  ApiRequestError,
  type ApiErrorBody,
  type ApiSuccessBody,
} from "@/lib/api";
import { getVendorSession } from "@/lib/auth";
import type { MaterialOrderLineItem } from "@/lib/material-vendor";

/** Per-brand stock from GET /materials/products/{slug}/availability (Material: Catalog). */
export interface MaterialBrandStock {
  brand_id: string;
  brand_name: string;
  stock_left_in_selling_unit: number;
  stock_unit: string;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  unit_price?: string | null;
}

export interface MaterialProductAvailability {
  product_slug: string;
  brands: MaterialBrandStock[];
}

export interface MaterialInventoryRow {
  product_id: string;
  product_slug: string;
  product_name: string;
  product_image_url: string | null;
  brand: MaterialBrandStock;
}

export interface MaterialStockValidation {
  valid: boolean;
  message: string | null;
  available_stock: number | null;
  stock_unit: string | null;
}

export interface MaterialLineItemStockInfo extends MaterialStockValidation {
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  matched_brand_name: string | null;
}

type CatalogSlugIndex = {
  byId: Map<string, string>;
  byName: Map<string, string>;
  bySlug: Map<string, { id: string; name: string; image: string | null }>;
};

let catalogSlugIndexPromise: Promise<CatalogSlugIndex | null> | null = null;
let catalogSlugIndexLoadedAt = 0;
const CATALOG_INDEX_TTL_MS = 5 * 60 * 1000;

function inventoryAuthHeaders(): HeadersInit {
  const session = getVendorSession();
  if (!session?.accessToken) {
    throw new ApiRequestError("Session expired. Please sign in again.", "UNAUTHORIZED", 401);
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessToken}`,
  };
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function normalizeLookupKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function slugifyProductName(name: string | null | undefined): string | null {
  const trimmed = name?.trim().toLowerCase();
  if (!trimmed) return null;
  const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || null;
}

function unwrapApiData<T>(body: ApiSuccessBody<T> | T): T {
  if (body && typeof body === "object" && "success" in body && body.success && "data" in body) {
    return body.data as T;
  }
  return body as T;
}

function normalizeBrandStock(raw: Record<string, unknown>): MaterialBrandStock | null {
  const brandId = pickString(raw, ["brand_id", "brandId", "id"]);
  const brandName = pickString(raw, ["brand_name", "brandName", "name"]);
  if (!brandId || !brandName) return null;

  return {
    brand_id: brandId,
    brand_name: brandName,
    stock_left_in_selling_unit: pickNumber(raw, [
      "stock_left_in_selling_unit",
      "stockLeftInSellingUnit",
      "available_stock",
      "availableStock",
      "stock",
    ]),
    stock_unit:
      pickString(raw, ["stock_unit", "stockUnit", "unit", "selling_unit"]) ?? "units",
    low_stock_threshold: pickNumber(raw, ["low_stock_threshold", "lowStockThreshold"]),
    is_low_stock: Boolean(raw.is_low_stock ?? raw.isLowStock),
    is_out_of_stock: Boolean(raw.is_out_of_stock ?? raw.isOutOfStock),
    unit_price: pickString(raw, ["unit_price", "unitPrice"]),
  };
}

function normalizeAvailability(
  slug: string,
  payload: Record<string, unknown>
): MaterialProductAvailability {
  const brandsRaw = payload.brands ?? payload.availability ?? payload.items;
  const brands = Array.isArray(brandsRaw)
    ? brandsRaw
        .map((entry) =>
          entry && typeof entry === "object"
            ? normalizeBrandStock(entry as Record<string, unknown>)
            : null
        )
        .filter((brand): brand is MaterialBrandStock => brand !== null)
    : [];

  return { product_slug: slug, brands };
}

export function formatStockQuantity(stock: number, unit: string | null): string {
  const unitLabel = unit?.trim() || "units";
  return `${stock.toLocaleString("en-IN")} ${unitLabel}`;
}

export function validateQuantityAgainstStock(
  quantity: number,
  availableStock: number | null,
  stockUnit: string | null
): MaterialStockValidation {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return {
      valid: false,
      message: "Quantity must be greater than zero.",
      available_stock: availableStock,
      stock_unit: stockUnit,
    };
  }

  if (availableStock === null) {
    return {
      valid: false,
      message: "Stock availability could not be verified for this material.",
      available_stock: null,
      stock_unit: stockUnit,
    };
  }

  if (availableStock <= 0) {
    return {
      valid: false,
      message: `This material is out of stock${stockUnit ? ` (${stockUnit})` : ""}.`,
      available_stock: availableStock,
      stock_unit: stockUnit,
    };
  }

  if (quantity > availableStock) {
    return {
      valid: false,
      message: `Only ${formatStockQuantity(availableStock, stockUnit)} available in stock.`,
      available_stock: availableStock,
      stock_unit: stockUnit,
    };
  }

  return {
    valid: true,
    message: null,
    available_stock: availableStock,
    stock_unit: stockUnit,
  };
}

function pickBrandForLineItem(
  brands: MaterialBrandStock[],
  brandName: string | null | undefined
): MaterialBrandStock | null {
  if (brands.length === 0) return null;

  const normalizedBrand = normalizeLookupKey(brandName);
  if (normalizedBrand) {
    const exact = brands.find(
      (brand) => normalizeLookupKey(brand.brand_name) === normalizedBrand
    );
    if (exact) return exact;
  }

  const inStock = brands.filter((brand) => !brand.is_out_of_stock);
  if (inStock.length === 0) return brands[0] ?? null;

  return inStock.reduce((best, current) =>
    current.stock_left_in_selling_unit > best.stock_left_in_selling_unit ? current : best
  );
}

function resolveAvailableStockForOrder(
  brands: MaterialBrandStock[],
  brandName: string | null | undefined,
  orderedQuantity: number
): { stock: number | null; brand: MaterialBrandStock | null } {
  const matched = pickBrandForLineItem(brands, brandName);
  if (matched) {
    return { stock: matched.stock_left_in_selling_unit, brand: matched };
  }

  const maxStock = brands.reduce(
    (max, brand) => Math.max(max, brand.stock_left_in_selling_unit),
    0
  );
  return { stock: maxStock > 0 ? maxStock : null, brand: brands[0] ?? null };
}

async function loadCatalogSlugIndex(headers: HeadersInit): Promise<CatalogSlugIndex | null> {
  const now = Date.now();
  if (catalogSlugIndexPromise && now - catalogSlugIndexLoadedAt < CATALOG_INDEX_TTL_MS) {
    return catalogSlugIndexPromise;
  }

  catalogSlugIndexLoadedAt = now;
  catalogSlugIndexPromise = (async () => {
    try {
      const response = await fetch(`${MATERIAL_API_BASE_URL}/materials/categories`, {
        headers,
        cache: "no-store",
      });
      if (!response.ok) return null;

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      const categories = data.categories ?? data;
      if (!Array.isArray(categories)) return null;

      const index: CatalogSlugIndex = {
        byId: new Map(),
        byName: new Map(),
        bySlug: new Map(),
      };

      for (const parent of categories) {
        if (!parent || typeof parent !== "object") continue;
        const children = (parent as Record<string, unknown>).children;
        if (!Array.isArray(children)) continue;

        for (const child of children) {
          if (!child || typeof child !== "object") continue;
          const categorySlug = pickString(child as Record<string, unknown>, ["slug"]);
          if (!categorySlug) continue;

          const productsResponse = await fetch(
            `${MATERIAL_API_BASE_URL}/materials/categories/${encodeURIComponent(categorySlug)}/products`,
            { headers, cache: "no-store" }
          );
          if (!productsResponse.ok) continue;

          const productsPayload = unwrapApiData<unknown>(await productsResponse.json());
          const products = Array.isArray(productsPayload)
            ? productsPayload
            : Array.isArray((productsPayload as Record<string, unknown>).products)
              ? ((productsPayload as Record<string, unknown>).products as unknown[])
              : Array.isArray((productsPayload as Record<string, unknown>).items)
                ? ((productsPayload as Record<string, unknown>).items as unknown[])
                : [];

          for (const product of products) {
            if (!product || typeof product !== "object") continue;
            const record = product as Record<string, unknown>;
            const slug = pickString(record, ["slug", "product_slug"]);
            const id = pickString(record, ["id", "product_id"]);
            const name = pickString(record, ["name", "product_name", "title"]);
            const image =
              pickString(record, ["hero_image_url", "primary_image_url", "image_url"]) ?? null;
            if (!slug) continue;

            index.bySlug.set(slug, {
              id: id ?? slug,
              name: name ?? slug,
              image,
            });
            if (id) index.byId.set(id, slug);
            const nameKey = normalizeLookupKey(name);
            if (nameKey) index.byName.set(nameKey, slug);
          }
        }
      }

      return index.bySlug.size > 0 ? index : null;
    } catch {
      return null;
    }
  })();

  return catalogSlugIndexPromise;
}

export async function resolveMaterialProductSlug(
  item: Pick<MaterialOrderLineItem, "product_slug" | "product_id" | "product_name">
): Promise<string | null> {
  if (item.product_slug?.trim()) return item.product_slug.trim();

  const headers = inventoryAuthHeaders();
  const index = await loadCatalogSlugIndex(headers);
  if (index) {
    if (item.product_id && index.byId.has(item.product_id)) {
      return index.byId.get(item.product_id) ?? null;
    }
    const nameKey = normalizeLookupKey(item.product_name);
    if (nameKey && index.byName.has(nameKey)) {
      return index.byName.get(nameKey) ?? null;
    }
  }

  return slugifyProductName(item.product_name);
}

export async function fetchMaterialProductAvailability(
  productSlug: string,
  variantId?: string | null
): Promise<MaterialProductAvailability> {
  const headers = inventoryAuthHeaders();
  const query = variantId ? `?variant_id=${encodeURIComponent(variantId)}` : "";
  const response = await fetch(
    `${MATERIAL_API_BASE_URL}/materials/products/${encodeURIComponent(productSlug)}/availability${query}`,
    { headers, cache: "no-store" }
  );

  const body = (await response.json()) as ApiSuccessBody<Record<string, unknown>> | ApiErrorBody;
  if (!response.ok || !("success" in body) || !body.success) {
    const errorBody = body as ApiErrorBody;
    throw new ApiRequestError(
      errorBody.error?.message ?? "Failed to load material stock availability.",
      errorBody.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      errorBody.error?.details
    );
  }

  const data = unwrapApiData<Record<string, unknown>>(body);
  return normalizeAvailability(productSlug, data);
}

export async function fetchMaterialVendorInventory(): Promise<MaterialInventoryRow[]> {
  const headers = inventoryAuthHeaders();
  const index = await loadCatalogSlugIndex(headers);
  if (!index) return [];

  const rows: MaterialInventoryRow[] = [];

  for (const [slug, product] of index.bySlug.entries()) {
    try {
      const availability = await fetchMaterialProductAvailability(slug);
      for (const brand of availability.brands) {
        rows.push({
          product_id: product.id,
          product_slug: slug,
          product_name: product.name,
          product_image_url: product.image,
          brand,
        });
      }
    } catch {
      continue;
    }
  }

  return rows.sort((a, b) => {
    const name = a.product_name.localeCompare(b.product_name);
    if (name !== 0) return name;
    return a.brand.brand_name.localeCompare(b.brand.brand_name);
  });
}

export async function resolveLineItemStockInfo(
  item: MaterialOrderLineItem
): Promise<MaterialLineItemStockInfo> {
  const slug = await resolveMaterialProductSlug(item);
  if (!slug) {
    return {
      valid: false,
      message: "Could not match this material to catalog stock.",
      available_stock: null,
      stock_unit: item.unit_label ?? item.unit,
      is_low_stock: false,
      is_out_of_stock: true,
      matched_brand_name: item.brand_name,
    };
  }

  try {
    const availability = await fetchMaterialProductAvailability(slug);
    const { stock, brand } = resolveAvailableStockForOrder(
      availability.brands,
      item.brand_name,
      item.quantity
    );
    const validation = validateQuantityAgainstStock(
      item.quantity,
      stock,
      brand?.stock_unit ?? item.unit_label ?? item.unit
    );

    return {
      ...validation,
      is_low_stock: brand?.is_low_stock ?? false,
      is_out_of_stock: brand?.is_out_of_stock ?? stock === 0,
      matched_brand_name: brand?.brand_name ?? item.brand_name,
    };
  } catch (err) {
    return {
      valid: false,
      message:
        err instanceof ApiRequestError
          ? err.message
          : "Failed to verify stock for this material.",
      available_stock: null,
      stock_unit: item.unit_label ?? item.unit,
      is_low_stock: false,
      is_out_of_stock: false,
      matched_brand_name: item.brand_name,
    };
  }
}

export async function validateOrderItemsStock(
  items: MaterialOrderLineItem[]
): Promise<{ valid: boolean; message: string | null; items: MaterialLineItemStockInfo[] }> {
  const results = await Promise.all(items.map((item) => resolveLineItemStockInfo(item)));
  const failure = results.find((result) => !result.valid);
  return {
    valid: !failure,
    message: failure?.message ?? null,
    items: results,
  };
}

export async function enrichLineItemsWithStock(
  items: MaterialOrderLineItem[]
): Promise<MaterialOrderLineItem[]> {
  if (items.length === 0) return items;

  const stockResults = await Promise.all(items.map((item) => resolveLineItemStockInfo(item)));

  return items.map((item, index) => {
    const stock = stockResults[index];
    return {
      ...item,
      available_stock: stock.available_stock,
      stock_unit: stock.stock_unit,
      is_low_stock: stock.is_low_stock,
      is_out_of_stock: stock.is_out_of_stock,
      stock_insufficient: !stock.valid,
      stock_validation_message: stock.message,
    };
  });
}
