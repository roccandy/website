/**
 * Mobile-only public-site spacing controls.
 *
 * Edit these values to change phone spacing without affecting laptop / desktop.
 */
export const MOBILE_SPACING_CONTROLS = {
  sharedPages: {
    sidePadding: "1.25rem",
    verticalPadding: "2rem",
    sectionGap: "1.25rem",
    sectionGapLarge: "2rem",
    sectionGapTight: "0.75rem",
    pageHeaderGap: "0.75rem",
    pageHeaderGapTight: "0.5rem",
    sectionStackGap: "1rem",
    richTextBlockGap: "1.25rem",
    uspTopOffset: "0.75rem",
    uspPillPaddingX: "0.5rem",
    uspPillPaddingY: "0.4rem",
    faqSectionGap: "1rem",
    faqHeadingGap: "0.25rem",
  },

  headerAndBanner: {
    headerRowGap: "1rem",
    headerActionsGap: "0.5rem",
    headerPaddingY: "0.75rem",
    topLinksGap: "1.5rem",
    topLinksPaddingY: "0.25rem",
    bannerPaddingY: "0.4rem",
  },

  homePage: {
    heroColumnsGap: "2.5rem",
    ctaToBoxesGap: "0rem",
    aboveH1: "1rem",
    belowH1: "1rem",
    belowH2: "1rem",
    belowParagraph: "0.75rem",
    belowUsp: "1.1rem",
    belowCta: "1rem",
    optionGridGap: "1rem",
    lowerSectionGridGap: "1rem",
    infoCardCopyTopGap: "1.5rem",
    contactGridGap: "1.25rem",
    contactColumnGap: "0.75rem",
  },

  landingPages: {
    aboveH1: "1rem",
    belowH1: "1rem",
    belowH2: "1rem",
    belowParagraph: "1rem",
    belowUsp: "1.1rem",
    belowCta: "0.5rem",
    ctaPaddingX: "1.25rem",
    ctaPaddingY: "0.75rem",
    gallerySideInset: "0.25rem",
    galleryRowGap: "1.25rem",
    galleryRowPaddingY: "0.5rem",
    galleryItemGap: "1rem",
    bodyCardPaddingX: "1.25rem",
    bodyCardPaddingY: "1.5rem",
  },

  productPages: {
    collectionGridGap: "1rem",
    collectionCardStackGap: "0.375rem",
    collectionCardMetaGap: "0.125rem",
    detailStackGap: "1rem",
    relatedSectionGap: "0.75rem",
    featureGridGap: "2rem",
  },
} as const;
