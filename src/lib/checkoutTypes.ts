export type CustomCartItemPayload = {
  id?: string;
  title?: string;
  description?: string;
  categoryId?: string;
  packagingOptionId?: string;
  quantity: number;
  packagingLabel?: string | null;
  jarLidColor?: string | null;
  labelsCount?: number | null;
  labelImageUrl?: string | null;
  labelTypeId?: string | null;
  ingredientLabelsOptIn?: boolean;
  jacket?: string | null;
  jacketType?: string | null;
  jacketColorOne?: string | null;
  jacketColorTwo?: string | null;
  textColor?: string | null;
  heartColor?: string | null;
  flavor?: string | null;
  logoUrl?: string | null;
  designType?: string | null;
  designText?: string | null;
  jacketExtras?: Array<{ jacket: "rainbow" | "two_colour" | "pinstripe" }>;
};

export type PremadeCartItemPayload = {
  premadeId: string;
  quantity: number;
};

export type CheckoutOrderPayload = {
  dueDate?: string;
  pickup?: boolean;
  paymentPreference?: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    organizationName?: string;
    addressLine1?: string;
    addressLine2?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
  };
  customItems: CustomCartItemPayload[];
  premadeItems: PremadeCartItemPayload[];
};
