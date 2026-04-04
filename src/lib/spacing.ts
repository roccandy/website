import type { CSSProperties } from "react";

/**
 * Global layout and spacing controls for the public site.
 *
 * Update these values instead of editing raw Tailwind `space-y-*`, `gap-*`,
 * `pt-*`, or `mb-*` classes throughout the app.
 */
export const SPACING = {
  pageInlinePadding: "1.5rem",
  pageBlockPadding: "2.5rem",
  pageBlockPaddingMd: "3.5rem",

  pageStackGap: "1.5rem",
  pageStackGapLarge: "2.5rem",
  pageStackGapTight: "0.75rem",

  pageHeaderGap: "0.75rem",
  pageHeaderGapTight: "0.5rem",
  sectionGap: "1rem",
  richContentGap: "1.25rem",

  faqSectionGap: "1rem",
  faqHeadingGap: "0.25rem",

  headerRowGap: "1rem",
  headerActionsGap: "0.5rem",
  headerPaddingY: "1rem",
  topLinksGap: "1.5rem",
  topLinksPaddingY: "0.25rem",
  bannerPaddingY: "0.5rem",

  uspOffset: "0.75rem",

  homeHeroGridGap: "5rem",
  homeHeroColumnGap: "2.5rem",
  homeHeroTitleBefore: "3rem",
  homeHeroTitleAfter: "3rem",
  homeHeroH2After: "0.5rem",
  homeHeroParagraphAfter: "0.5rem",
  homeHeroCtaOffset: "2rem",
  homeOptionGridGap: "1rem",
  homeSecondaryGridGap: "1.25rem",
  homeCardBodyGap: "1rem",
  homeContactGridGap: "1.5rem",
  homeContactColumnGap: "0.75rem",

  landingHeroSectionGap: "2.5rem",
  landingHeroContentGap: "1.5rem",
  landingHeroHeadingGap: "0.25rem",
  landingHeroTitleAfter: "1rem",
  landingGalleryGap: "1.5rem",
  landingGalleryRowPaddingY: "0.5rem",
  landingGalleryItemGap: "1.5rem",

  productGridGap: "1rem",
  productCardGap: "0.375rem",
  productCardMetaGap: "0.125rem",
  productDetailStackGap: "1rem",
  relatedSectionGap: "0.75rem",
  productFeatureGridGap: "2rem",
} as const;

export const SPACING_STYLE_VARS: CSSProperties = {
  "--space-page-inline-padding": SPACING.pageInlinePadding,
  "--space-page-block-padding": SPACING.pageBlockPadding,
  "--space-page-block-padding-md": SPACING.pageBlockPaddingMd,

  "--space-page-stack-gap": SPACING.pageStackGap,
  "--space-page-stack-gap-large": SPACING.pageStackGapLarge,
  "--space-page-stack-gap-tight": SPACING.pageStackGapTight,

  "--space-page-header-gap": SPACING.pageHeaderGap,
  "--space-page-header-gap-tight": SPACING.pageHeaderGapTight,
  "--space-section-gap": SPACING.sectionGap,
  "--space-rich-content-gap": SPACING.richContentGap,

  "--space-faq-section-gap": SPACING.faqSectionGap,
  "--space-faq-heading-gap": SPACING.faqHeadingGap,

  "--space-header-row-gap": SPACING.headerRowGap,
  "--space-header-actions-gap": SPACING.headerActionsGap,
  "--space-header-padding-y": SPACING.headerPaddingY,
  "--space-top-links-gap": SPACING.topLinksGap,
  "--space-top-links-padding-y": SPACING.topLinksPaddingY,
  "--space-banner-padding-y": SPACING.bannerPaddingY,

  "--space-usp-offset": SPACING.uspOffset,

  "--space-home-hero-grid-gap": SPACING.homeHeroGridGap,
  "--space-home-hero-column-gap": SPACING.homeHeroColumnGap,
  "--space-home-hero-title-before": SPACING.homeHeroTitleBefore,
  "--space-home-hero-title-after": SPACING.homeHeroTitleAfter,
  "--space-home-hero-h2-after": SPACING.homeHeroH2After,
  "--space-home-hero-paragraph-after": SPACING.homeHeroParagraphAfter,
  "--space-home-hero-cta-offset": SPACING.homeHeroCtaOffset,
  "--space-home-option-grid-gap": SPACING.homeOptionGridGap,
  "--space-home-secondary-grid-gap": SPACING.homeSecondaryGridGap,
  "--space-home-card-body-gap": SPACING.homeCardBodyGap,
  "--space-home-contact-grid-gap": SPACING.homeContactGridGap,
  "--space-home-contact-column-gap": SPACING.homeContactColumnGap,

  "--space-landing-hero-section-gap": SPACING.landingHeroSectionGap,
  "--space-landing-hero-content-gap": SPACING.landingHeroContentGap,
  "--space-landing-hero-heading-gap": SPACING.landingHeroHeadingGap,
  "--space-landing-hero-title-after": SPACING.landingHeroTitleAfter,
  "--space-landing-gallery-gap": SPACING.landingGalleryGap,
  "--space-landing-gallery-row-padding-y": SPACING.landingGalleryRowPaddingY,
  "--space-landing-gallery-item-gap": SPACING.landingGalleryItemGap,

  "--space-product-grid-gap": SPACING.productGridGap,
  "--space-product-card-gap": SPACING.productCardGap,
  "--space-product-card-meta-gap": SPACING.productCardMetaGap,
  "--space-product-detail-stack-gap": SPACING.productDetailStackGap,
  "--space-related-section-gap": SPACING.relatedSectionGap,
  "--space-product-feature-grid-gap": SPACING.productFeatureGridGap,
} as CSSProperties;
