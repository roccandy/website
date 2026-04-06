import type { CSSProperties } from "react";

/**
 * Public-site spacing control panel.
 *
 * Edit the values in `SPACING_CONTROLS` only.
 * The CSS variable mapping underneath is just the plumbing that feeds globals.css.
 */
export const SPACING_CONTROLS = {
  sharedPages: {
    // Left/right padding on most public pages.
    sidePadding: "1.5rem",
    // Top/bottom padding on most public pages on mobile.
    verticalPaddingMobile: "2.5rem",
    // Top/bottom padding on most public pages on desktop.
    verticalPaddingDesktop: "3.5rem",

    // Default gap between major stacked sections on a page.
    sectionGap: "1.5rem",
    // Larger version of the major section gap.
    sectionGapLarge: "2.5rem",
    // Tighter version of the major section gap.
    sectionGapTight: "0.75rem",

    // Gap inside a standard page intro block.
    pageHeaderGap: "0.75rem",
    // Tighter version of the page intro gap.
    pageHeaderGapTight: "0.5rem",

    // Generic gap for small internal section stacks.
    sectionStackGap: "1rem",
    // Gap between blocks inside rich text / admin-managed HTML content.
    richTextBlockGap: "1.25rem",

    // Top offset before the USP strip when a page uses it under the intro.
    uspTopOffset: "0.75rem",

    // Gap between an FAQ heading block and its accordion.
    faqSectionGap: "1rem",
    // Gap inside the FAQ heading block itself.
    faqHeadingGap: "0.25rem",
  },

  headerAndBanner: {
    // Gap between logo, nav, and header actions.
    headerRowGap: "1rem",
    // Gap between the mail / phone / menu buttons.
    headerActionsGap: "0.5rem",
    // Top/bottom padding inside the main sticky header.
    headerPaddingY: "0.75rem",

    // Gap between FAQ / About / Blog in the tiny top links bar.
    topLinksGap: "1.5rem",
    // Top/bottom padding inside the tiny top links bar.
    topLinksPaddingY: "0.25rem",

    // Top/bottom padding inside the production notice banner.
    bannerPaddingY: "0.4rem",
  },

  homePage: {
    // Gap between the left text column and the right option-card grid.
    heroColumnsGap: "5rem",

    // Space above the homepage H1.
    aboveH1: "4rem",
    // Space below the homepage H1 and above the H2.
    belowH1: "1.5rem",
    // Space below the homepage H2 and above the paragraph.
    belowH2: "0.5rem",
    // Space below the homepage paragraph and above the USP strip.
    belowParagraph: "2.5rem",
    // Space below the homepage USP strip and above the CTA.
    belowUsp: "4rem",
    // Space below the homepage CTA and above the next section.
    belowCta: "3rem",

    // Gap between the homepage option cards on the right.
    optionGridGap: "1rem",
    // Gap between the large cards / video section underneath the hero.
    lowerSectionGridGap: "1.25rem",
    // Space above the copy paragraph inside the white info cards.
    infoCardCopyTopGap: "2rem",

    // Gap between the two columns in the dark contact block.
    contactGridGap: "1.5rem",
    // Gap between items inside each column of the contact block.
    contactColumnGap: "0.75rem",
  },

  landingPages: {
    // Space above the landing-page H1.
    aboveH1: "4rem",
    // Space below the landing-page H1 and above the H2.
    belowH1: "1.5rem",
    // Space below the landing-page H2 and above the paragraph.
    belowH2: "0.5rem",
    // Space below the landing-page paragraph and above the USP strip.
    belowParagraph: "3.6rem",
    // Space below the landing-page USP strip and above the CTA.
    belowUsp: "4.5rem",
    // Space below the landing-page CTA and above the gallery rows.
    belowCta: "3rem",

    // Horizontal padding inside the pink CTA button.
    ctaPaddingX: "1.75rem",
    // Vertical padding inside the pink CTA button.
    ctaPaddingY: "0.7rem",

    // Left/right inset around the whole scrolling gallery area.
    gallerySideInset: "0.25rem",
    // Gap between gallery rows.
    galleryRowGap: "1.5rem",
    // Top/bottom padding around each gallery row.
    galleryRowPaddingY: "0.5rem",
    // Gap between cards inside each gallery row.
    galleryItemGap: "1.5rem",

    // Left/right padding for the white body content card on mobile.
    bodyCardPaddingXMobile: "1.5rem",
    // Left/right padding for the white body content card on desktop.
    bodyCardPaddingXDesktop: "2rem",
    // Top/bottom padding for the white body content card.
    // Matched to the homepage card padding feel on mobile.
    bodyCardPaddingY: "1.5rem",
  },

  productPages: {
    // Gap between cards in the pre-made collection grids.
    collectionGridGap: "1rem",
    // Gap between stacked elements inside each collection card.
    collectionCardStackGap: "0.375rem",
    // Gap inside the price/meta cluster in each collection card.
    collectionCardMetaGap: "0.125rem",

    // Gap inside the right-hand content stack on a product detail page.
    detailStackGap: "1rem",
    // Gap between the related-products heading and its grid.
    relatedSectionGap: "0.75rem",
    // Gap between the two columns on a pre-made detail page.
    featureGridGap: "2rem",
  },
} as const;

const shared = SPACING_CONTROLS.sharedPages;
const header = SPACING_CONTROLS.headerAndBanner;
const home = SPACING_CONTROLS.homePage;
const landing = SPACING_CONTROLS.landingPages;
const product = SPACING_CONTROLS.productPages;

export const SPACING_STYLE_VARS: CSSProperties = {
  "--space-page-inline-padding": shared.sidePadding,
  "--space-page-block-padding": shared.verticalPaddingMobile,
  "--space-page-block-padding-md": shared.verticalPaddingDesktop,

  "--space-page-stack-gap": shared.sectionGap,
  "--space-page-stack-gap-large": shared.sectionGapLarge,
  "--space-page-stack-gap-tight": shared.sectionGapTight,

  "--space-page-header-gap": shared.pageHeaderGap,
  "--space-page-header-gap-tight": shared.pageHeaderGapTight,
  "--space-section-gap": shared.sectionStackGap,
  "--space-rich-content-gap": shared.richTextBlockGap,
  "--space-usp-offset": shared.uspTopOffset,
  "--space-faq-section-gap": shared.faqSectionGap,
  "--space-faq-heading-gap": shared.faqHeadingGap,

  "--space-header-row-gap": header.headerRowGap,
  "--space-header-actions-gap": header.headerActionsGap,
  "--space-header-padding-y": header.headerPaddingY,
  "--space-top-links-gap": header.topLinksGap,
  "--space-top-links-padding-y": header.topLinksPaddingY,
  "--space-banner-padding-y": header.bannerPaddingY,

  "--space-home-hero-grid-gap": home.heroColumnsGap,
  "--space-home-hero-title-before": home.aboveH1,
  "--space-home-hero-title-after": home.belowH1,
  "--space-home-hero-h2-after": home.belowH2,
  "--space-home-hero-paragraph-to-usp": home.belowParagraph,
  "--space-home-hero-usp-to-cta": home.belowUsp,
  "--space-home-hero-cta-to-next": home.belowCta,
  "--space-home-option-grid-gap": home.optionGridGap,
  "--space-home-secondary-grid-gap": home.lowerSectionGridGap,
  "--space-home-card-body-gap": home.infoCardCopyTopGap,
  "--space-home-contact-grid-gap": home.contactGridGap,
  "--space-home-contact-column-gap": home.contactColumnGap,

  "--space-landing-hero-title-before": landing.aboveH1,
  "--space-landing-hero-title-after": landing.belowH1,
  "--space-landing-hero-h2-after": landing.belowH2,
  "--space-landing-hero-paragraph-to-usp": landing.belowParagraph,
  "--space-landing-hero-usp-to-cta": landing.belowUsp,
  "--space-landing-hero-cta-to-gallery": landing.belowCta,
  "--space-landing-cta-padding-x": landing.ctaPaddingX,
  "--space-landing-cta-padding-y": landing.ctaPaddingY,
  "--space-landing-gallery-inset-x": landing.gallerySideInset,
  "--space-landing-gallery-gap": landing.galleryRowGap,
  "--space-landing-gallery-row-padding-y": landing.galleryRowPaddingY,
  "--space-landing-gallery-item-gap": landing.galleryItemGap,
  "--space-landing-body-card-padding-x": landing.bodyCardPaddingXMobile,
  "--space-landing-body-card-padding-x-md": landing.bodyCardPaddingXDesktop,
  "--space-landing-body-card-padding-y": landing.bodyCardPaddingY,

  "--space-product-grid-gap": product.collectionGridGap,
  "--space-product-card-gap": product.collectionCardStackGap,
  "--space-product-card-meta-gap": product.collectionCardMetaGap,
  "--space-product-detail-stack-gap": product.detailStackGap,
  "--space-related-section-gap": product.relatedSectionGap,
  "--space-product-feature-grid-gap": product.featureGridGap,
} as CSSProperties;
