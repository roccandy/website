import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/siteUrl";

const SITE_NAME = "Roc Candy";
const DEFAULT_TITLE = "Personalised Rock Candy Australia | Wedding, Branded & Custom Candy";
const DEFAULT_DESCRIPTION =
  "Handmade personalised rock candy for weddings, branded events, gifts, and celebrations across Australia. Vegan, gluten free, dairy free, and delivered Australia wide.";
const DEFAULT_OG_IMAGE_PATH = "/landing/home-feature-poster.png";
const DEFAULT_PHONE = "+61 414 519 211";
const DEFAULT_EMAIL = "enquiries@roccandy.com.au";

type BuildMetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  imagePath?: string;
  imageAlt?: string;
  noIndex?: boolean;
};

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

export function getSiteName() {
  return SITE_NAME;
}

export function getDefaultSeoDescription() {
  return DEFAULT_DESCRIPTION;
}

export function getSiteBaseMetadata() {
  const baseUrl = getSiteBaseUrl();
  const logoUrl = buildAbsoluteUrl("/branding/logo-gold.svg");
  const socialProfiles = [
    "https://www.facebook.com/RocCandyPages/",
    "https://www.instagram.com/roccandyyum/",
  ];

  return {
    baseUrl,
    logoUrl,
    defaultOgImageUrl: buildAbsoluteUrl(DEFAULT_OG_IMAGE_PATH),
    defaultEmail: process.env.ENQUIRIES_EMAIL?.trim() || DEFAULT_EMAIL,
    defaultPhone: DEFAULT_PHONE,
    socialProfiles,
  };
}

export function buildAbsoluteUrl(path = "/") {
  const baseUrl = getSiteBaseUrl();
  if (!path || path === "/") return baseUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}/${trimSlashes(path)}`;
}

export function buildCanonicalPath(path = "/") {
  if (!path || path === "/") return "/";
  return `/${trimSlashes(path)}`;
}

export function buildMetadata({
  title,
  description,
  path = "/",
  imagePath = DEFAULT_OG_IMAGE_PATH,
  imageAlt = SITE_NAME,
  noIndex = false,
}: BuildMetadataInput = {}): Metadata {
  const resolvedTitle = title ?? DEFAULT_TITLE;
  const resolvedDescription = description ?? DEFAULT_DESCRIPTION;
  const canonicalPath = buildCanonicalPath(path);
  const url = buildAbsoluteUrl(canonicalPath);
  const imageUrl = buildAbsoluteUrl(imagePath);

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical: canonicalPath,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
        },
    openGraph: {
      type: "website",
      locale: "en_AU",
      siteName: SITE_NAME,
      title: resolvedTitle,
      description: resolvedDescription,
      url,
      images: [
        {
          url: imageUrl,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: [imageUrl],
    },
  };
}

export function buildSearchConsoleVerification(): Metadata["verification"] {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined;
  const yandex = process.env.YANDEX_SITE_VERIFICATION?.trim() || undefined;
  const bing = process.env.BING_SITE_VERIFICATION?.trim() || undefined;

  return {
    google,
    yandex,
    other: bing
      ? {
          "msvalidate.01": bing,
        }
      : undefined,
  };
}

export function stripHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value: string | null | undefined, maxLength: number) {
  const normalized = (value ?? "").trim();
  if (!normalized || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildSchemaGraph(nodes: Record<string, unknown>[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

export function buildOrganizationSchema() {
  const { baseUrl, logoUrl, defaultEmail, defaultPhone, socialProfiles } = getSiteBaseMetadata();

  return {
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: SITE_NAME,
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      url: logoUrl,
    },
    email: defaultEmail,
    telephone: defaultPhone,
    sameAs: socialProfiles,
    address: {
      "@type": "PostalAddress",
      streetAddress: "53 View St",
      addressLocality: "North Perth",
      addressRegion: "WA",
      addressCountry: "AU",
    },
    areaServed: {
      "@type": "Country",
      name: "Australia",
    },
  };
}

export function buildWebsiteSchema() {
  const { baseUrl } = getSiteBaseMetadata();

  return {
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: SITE_NAME,
    url: baseUrl,
    publisher: {
      "@id": `${baseUrl}/#organization`,
    },
    inLanguage: "en-AU",
  };
}

export function buildWebPageSchema(input: {
  path: string;
  name: string;
  description?: string;
}) {
  const { baseUrl } = getSiteBaseMetadata();
  const url = buildAbsoluteUrl(input.path);

  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    isPartOf: {
      "@id": `${baseUrl}/#website`,
    },
    about: {
      "@id": `${baseUrl}/#organization`,
    },
    inLanguage: "en-AU",
  };
}

export function mapAvailabilityToSchema(availability: string | null | undefined) {
  switch ((availability ?? "").trim().toLowerCase()) {
    case "out_of_stock":
      return "https://schema.org/OutOfStock";
    case "backorder":
    case "preorder":
      return "https://schema.org/PreOrder";
    default:
      return "https://schema.org/InStock";
  }
}

export function toOpenGraphImage(imageUrl: string, alt: string) {
  return {
    url: imageUrl,
    alt,
  };
}
