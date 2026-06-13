export type InternalOrderType = "weddings" | "text" | "branded";

export type PublicDesignerType = "wedding" | "text" | "branded";

export type PublicDesignerVariant = "initials" | "names" | "short" | "long";

const DESIGN_QUERY_KEYS = new Set(["type", "variant", "subtype"]);

type DesignerRouteState = {
  orderType: InternalOrderType;
  categoryId: string | null;
  publicType: PublicDesignerType;
  publicVariant: PublicDesignerVariant | null;
  landingPath: string;
};

const CATEGORY_TO_PUBLIC_STATE: Record<string, DesignerRouteState> = {
  "weddings-initials": {
    orderType: "weddings",
    categoryId: "weddings-initials",
    publicType: "wedding",
    publicVariant: "initials",
    landingPath: "/design/wedding-candy",
  },
  "weddings-both-names": {
    orderType: "weddings",
    categoryId: "weddings-both-names",
    publicType: "wedding",
    publicVariant: "names",
    landingPath: "/design/wedding-candy",
  },
  "custom-1-6": {
    orderType: "text",
    categoryId: "custom-1-6",
    publicType: "text",
    publicVariant: "short",
    landingPath: "/design/custom-text-candy",
  },
  "custom-7-14": {
    orderType: "text",
    categoryId: "custom-7-14",
    publicType: "text",
    publicVariant: "long",
    landingPath: "/design/custom-text-candy",
  },
  branded: {
    orderType: "branded",
    categoryId: "branded",
    publicType: "branded",
    publicVariant: null,
    landingPath: "/design/branded-logo-candy",
  },
};

const DEFAULT_CATEGORY_BY_TYPE: Partial<Record<PublicDesignerType, string>> = {
  wedding: "weddings-initials",
  text: "custom-1-6",
};

function normalizeType(raw?: string | null): PublicDesignerType | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "wedding" || value === "weddings") return "wedding";
  if (value === "text") return "text";
  if (value === "branded") return "branded";
  return undefined;
}

function resolveVariantForType(
  type: PublicDesignerType,
  rawVariant?: string | null,
  rawSubtype?: string | null,
): PublicDesignerVariant | undefined {
  const variant = (rawVariant ?? "").trim().toLowerCase();
  const subtype = (rawSubtype ?? "").trim().toLowerCase();

  if (type === "wedding") {
    if (variant === "initials" || subtype === "weddings-initials") return "initials";
    if (variant === "names" || variant === "both-names" || subtype === "weddings-both-names") return "names";
  }

  if (type === "text") {
    if (variant === "short" || variant === "1-6" || subtype === "custom-1-6") return "short";
    if (variant === "long" || variant === "7-14" || subtype === "custom-7-14") return "long";
  }

  return undefined;
}

export function resolveDesignerState(input: {
  type?: string | null;
  variant?: string | null;
  subtype?: string | null;
}): DesignerRouteState | null {
  const type = normalizeType(input.type ?? input.subtype ?? null);
  if (!type) return null;

  if (type === "branded") {
    return CATEGORY_TO_PUBLIC_STATE.branded;
  }

  const publicVariant = resolveVariantForType(type, input.variant, input.subtype);
  if (!publicVariant) {
    const defaultCategoryId = DEFAULT_CATEGORY_BY_TYPE[type];
    if (defaultCategoryId) {
      return CATEGORY_TO_PUBLIC_STATE[defaultCategoryId];
    }
    return CATEGORY_TO_PUBLIC_STATE.branded;
  }

  if (type === "wedding") {
    return publicVariant === "initials"
      ? CATEGORY_TO_PUBLIC_STATE["weddings-initials"]
      : CATEGORY_TO_PUBLIC_STATE["weddings-both-names"];
  }

  return publicVariant === "short"
    ? CATEGORY_TO_PUBLIC_STATE["custom-1-6"]
    : CATEGORY_TO_PUBLIC_STATE["custom-7-14"];
}

function mergeExtraParams(
  searchParams: URLSearchParams,
  extraParams?:
    | URLSearchParams
    | Record<string, string | null | undefined>,
) {
  if (!extraParams) return;

  if (extraParams instanceof URLSearchParams) {
    extraParams.forEach((value, key) => {
      if (!DESIGN_QUERY_KEYS.has(key) && value) {
        searchParams.set(key, value);
      }
    });
    return;
  }

  Object.entries(extraParams).forEach(([key, value]) => {
    if (!DESIGN_QUERY_KEYS.has(key) && value) {
      searchParams.set(key, value);
    }
  });
}

export function buildDesignerPath(input: {
  orderType: InternalOrderType;
  categoryId?: string | null;
  extraParams?: URLSearchParams | Record<string, string | null | undefined>;
}) {
  const state =
    (input.categoryId ? CATEGORY_TO_PUBLIC_STATE[input.categoryId] : null) ??
    (input.orderType === "weddings"
      ? CATEGORY_TO_PUBLIC_STATE["weddings-initials"]
      : input.orderType === "text"
        ? CATEGORY_TO_PUBLIC_STATE["custom-1-6"]
        : CATEGORY_TO_PUBLIC_STATE.branded);

  const searchParams = new URLSearchParams();
  searchParams.set("type", state.publicType);
  if (state.publicVariant) {
    searchParams.set("variant", state.publicVariant);
  }
  mergeExtraParams(searchParams, input.extraParams);
  const query = searchParams.toString();
  return query ? `/design?${query}` : "/design";
}

export function inferDesignerOrderTypeFromCategory(value?: string | null): InternalOrderType {
  if (!value) return "weddings";
  if (value === "weddings" || value.startsWith("weddings-")) return "weddings";
  if (value === "text" || value.startsWith("custom-")) return "text";
  if (value === "branded") return "branded";
  return "weddings";
}

export function buildDesignerEditPath(input: {
  itemId: string;
  categoryId?: string | null;
  designType?: string | null;
}) {
  const categoryId = input.categoryId || input.designType || null;
  return buildDesignerPath({
    orderType: inferDesignerOrderTypeFromCategory(categoryId),
    categoryId,
    extraParams: { edit: input.itemId },
  });
}

export function getDesignerCanonicalTarget(input: {
  type?: string | null;
  variant?: string | null;
  subtype?: string | null;
}) {
  const state = resolveDesignerState(input);
  return state?.landingPath ?? "/design";
}

export function isLegacyDesignerQuery(input: {
  type?: string | null;
  variant?: string | null;
  subtype?: string | null;
}) {
  const type = (input.type ?? "").trim().toLowerCase();
  return type === "weddings" || Boolean((input.subtype ?? "").trim());
}
