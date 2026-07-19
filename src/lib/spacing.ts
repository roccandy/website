import type { CSSProperties } from "react";
import { MOBILE_SPACING_CONTROLS } from "@/lib/mobileSpacing";

/**
 * Public-site spacing control panel.
 *
 * Edit `SPACING_CONTROLS` for desktop / laptop spacing.
 * Edit `mobileSpacing.ts` for mobile-only spacing.
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
    // Left/right padding inside the USP bubble.
    uspPillPaddingX: "1rem",
    // Top/bottom padding inside the USP bubble.
    uspPillPaddingY: "0.5rem",

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
    // On mobile this is the space below the CTA and above the six option boxes.
    // On desktop it only matters if the grid wraps to multiple rows.
    ctaToBoxesGap: "3rem",

    // Space above the homepage H1.
    aboveH1: "4rem",
    // Space below the homepage H1 and above the H2.
    belowH1: "1.5rem",
    // Space below the homepage H2 and above the paragraph.
    belowH2: "0.5rem",
    // Space below the homepage paragraph and above the USP strip.
    belowParagraph: "2.5rem",
    // Space below the homepage USP strip and above the CTA.
    belowUsp: "3.5rem",
    // Space below the homepage CTA and above the next section.
    belowCta: "2rem",

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
    belowCta: "1rem",

    // Horizontal padding inside the pink CTA button.
    ctaPaddingX: "1.5rem",
    // Vertical padding inside the pink CTA button.
    ctaPaddingY: "0.75rem",

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
const mobileShared = MOBILE_SPACING_CONTROLS.sharedPages;
const mobileHeader = MOBILE_SPACING_CONTROLS.headerAndBanner;
const mobileHome = MOBILE_SPACING_CONTROLS.homePage;
const mobileLanding = MOBILE_SPACING_CONTROLS.landingPages;
const mobileProduct = MOBILE_SPACING_CONTROLS.productPages;

export const SPACING_STYLE_VARS: CSSProperties = {
  "--space-page-inline-padding-mobile": mobileShared.sidePadding,
  "--space-page-inline-padding-desktop": shared.sidePadding,
  "--space-page-block-padding-mobile": mobileShared.verticalPadding,
  "--space-page-block-padding-desktop": shared.verticalPaddingDesktop,

  "--space-page-stack-gap-mobile": mobileShared.sectionGap,
  "--space-page-stack-gap-desktop": shared.sectionGap,
  "--space-page-stack-gap-large-mobile": mobileShared.sectionGapLarge,
  "--space-page-stack-gap-large-desktop": shared.sectionGapLarge,
  "--space-page-stack-gap-tight-mobile": mobileShared.sectionGapTight,
  "--space-page-stack-gap-tight-desktop": shared.sectionGapTight,

  "--space-page-header-gap-mobile": mobileShared.pageHeaderGap,
  "--space-page-header-gap-desktop": shared.pageHeaderGap,
  "--space-page-header-gap-tight-mobile": mobileShared.pageHeaderGapTight,
  "--space-page-header-gap-tight-desktop": shared.pageHeaderGapTight,
  "--space-section-gap-mobile": mobileShared.sectionStackGap,
  "--space-section-gap-desktop": shared.sectionStackGap,
  "--space-rich-content-gap-mobile": mobileShared.richTextBlockGap,
  "--space-rich-content-gap-desktop": shared.richTextBlockGap,
  "--space-usp-offset-mobile": mobileShared.uspTopOffset,
  "--space-usp-offset-desktop": shared.uspTopOffset,
  "--space-usp-pill-padding-x-mobile": mobileShared.uspPillPaddingX,
  "--space-usp-pill-padding-x-desktop": shared.uspPillPaddingX,
  "--space-usp-pill-padding-y-mobile": mobileShared.uspPillPaddingY,
  "--space-usp-pill-padding-y-desktop": shared.uspPillPaddingY,
  "--space-faq-section-gap-mobile": mobileShared.faqSectionGap,
  "--space-faq-section-gap-desktop": shared.faqSectionGap,
  "--space-faq-heading-gap-mobile": mobileShared.faqHeadingGap,
  "--space-faq-heading-gap-desktop": shared.faqHeadingGap,

  "--space-header-row-gap-mobile": mobileHeader.headerRowGap,
  "--space-header-row-gap-desktop": header.headerRowGap,
  "--space-header-actions-gap-mobile": mobileHeader.headerActionsGap,
  "--space-header-actions-gap-desktop": header.headerActionsGap,
  "--space-header-padding-y-mobile": mobileHeader.headerPaddingY,
  "--space-header-padding-y-desktop": header.headerPaddingY,
  "--space-top-links-gap-mobile": mobileHeader.topLinksGap,
  "--space-top-links-gap-desktop": header.topLinksGap,
  "--space-top-links-padding-y-mobile": mobileHeader.topLinksPaddingY,
  "--space-top-links-padding-y-desktop": header.topLinksPaddingY,
  "--space-banner-padding-y-mobile": mobileHeader.bannerPaddingY,
  "--space-banner-padding-y-desktop": header.bannerPaddingY,

  "--space-home-hero-grid-gap-mobile": mobileHome.heroColumnsGap,
  "--space-home-hero-grid-gap-desktop": home.heroColumnsGap,
  "--space-home-hero-row-gap-mobile": mobileHome.ctaToBoxesGap,
  "--space-home-hero-row-gap-desktop": home.ctaToBoxesGap,
  "--space-home-hero-title-before-mobile": mobileHome.aboveH1,
  "--space-home-hero-title-before-desktop": home.aboveH1,
  "--space-home-hero-title-after-mobile": mobileHome.belowH1,
  "--space-home-hero-title-after-desktop": home.belowH1,
  "--space-home-hero-h2-after-mobile": mobileHome.belowH2,
  "--space-home-hero-h2-after-desktop": home.belowH2,
  "--space-home-hero-paragraph-to-usp-mobile": mobileHome.belowParagraph,
  "--space-home-hero-paragraph-to-usp-desktop": home.belowParagraph,
  "--space-home-hero-usp-to-cta-mobile": mobileHome.belowUsp,
  "--space-home-hero-usp-to-cta-desktop": home.belowUsp,
  "--space-home-hero-cta-to-next-mobile": mobileHome.belowCta,
  "--space-home-hero-cta-to-next-desktop": home.belowCta,
  "--space-home-option-grid-gap-mobile": mobileHome.optionGridGap,
  "--space-home-option-grid-gap-desktop": home.optionGridGap,
  "--space-home-secondary-grid-gap-mobile": mobileHome.lowerSectionGridGap,
  "--space-home-secondary-grid-gap-desktop": home.lowerSectionGridGap,
  "--space-home-card-body-gap-mobile": mobileHome.infoCardCopyTopGap,
  "--space-home-card-body-gap-desktop": home.infoCardCopyTopGap,
  "--space-home-contact-grid-gap-mobile": mobileHome.contactGridGap,
  "--space-home-contact-grid-gap-desktop": home.contactGridGap,
  "--space-home-contact-column-gap-mobile": mobileHome.contactColumnGap,
  "--space-home-contact-column-gap-desktop": home.contactColumnGap,

  "--space-landing-hero-title-before-mobile": mobileLanding.aboveH1,
  "--space-landing-hero-title-before-desktop": landing.aboveH1,
  "--space-landing-hero-title-after-mobile": mobileLanding.belowH1,
  "--space-landing-hero-title-after-desktop": landing.belowH1,
  "--space-landing-hero-h2-after-mobile": mobileLanding.belowH2,
  "--space-landing-hero-h2-after-desktop": landing.belowH2,
  "--space-landing-hero-paragraph-to-usp-mobile": mobileLanding.belowParagraph,
  "--space-landing-hero-paragraph-to-usp-desktop": landing.belowParagraph,
  "--space-landing-hero-usp-to-cta-mobile": mobileLanding.belowUsp,
  "--space-landing-hero-usp-to-cta-desktop": landing.belowUsp,
  "--space-landing-hero-cta-to-gallery-mobile": mobileLanding.belowCta,
  "--space-landing-hero-cta-to-gallery-desktop": landing.belowCta,
  "--space-landing-cta-padding-x-mobile": mobileLanding.ctaPaddingX,
  "--space-landing-cta-padding-x-desktop": landing.ctaPaddingX,
  "--space-landing-cta-padding-y-mobile": mobileLanding.ctaPaddingY,
  "--space-landing-cta-padding-y-desktop": landing.ctaPaddingY,
  "--space-landing-gallery-inset-x-mobile": mobileLanding.gallerySideInset,
  "--space-landing-gallery-inset-x-desktop": landing.gallerySideInset,
  "--space-landing-gallery-gap-mobile": mobileLanding.galleryRowGap,
  "--space-landing-gallery-gap-desktop": landing.galleryRowGap,
  "--space-landing-gallery-row-padding-y-mobile": mobileLanding.galleryRowPaddingY,
  "--space-landing-gallery-row-padding-y-desktop": landing.galleryRowPaddingY,
  "--space-landing-gallery-item-gap-mobile": mobileLanding.galleryItemGap,
  "--space-landing-gallery-item-gap-desktop": landing.galleryItemGap,
  "--space-landing-body-card-padding-x-mobile": mobileLanding.bodyCardPaddingX,
  "--space-landing-body-card-padding-x-desktop": landing.bodyCardPaddingXDesktop,
  "--space-landing-body-card-padding-y-mobile": mobileLanding.bodyCardPaddingY,
  "--space-landing-body-card-padding-y-desktop": landing.bodyCardPaddingY,

  "--space-product-grid-gap-mobile": mobileProduct.collectionGridGap,
  "--space-product-grid-gap-desktop": product.collectionGridGap,
  "--space-product-card-gap-mobile": mobileProduct.collectionCardStackGap,
  "--space-product-card-gap-desktop": product.collectionCardStackGap,
  "--space-product-card-meta-gap-mobile": mobileProduct.collectionCardMetaGap,
  "--space-product-card-meta-gap-desktop": product.collectionCardMetaGap,
  "--space-product-detail-stack-gap-mobile": mobileProduct.detailStackGap,
  "--space-product-detail-stack-gap-desktop": product.detailStackGap,
  "--space-related-section-gap-mobile": mobileProduct.relatedSectionGap,
  "--space-related-section-gap-desktop": product.relatedSectionGap,
  "--space-product-feature-grid-gap-mobile": mobileProduct.featureGridGap,
  "--space-product-feature-grid-gap-desktop": product.featureGridGap,
} as CSSProperties;
