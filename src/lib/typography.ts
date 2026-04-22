import type { CSSProperties } from "react";
import { MOBILE_TYPOGRAPHY } from "@/lib/mobileTypography";

/**
 * Global typography controls.
 *
 * Update `TYPOGRAPHY` for desktop / laptop typography.
 * Update `mobileTypography.ts` for mobile-only public-site typography.
 * Admin typography remains single-size for now.
 */
export const TYPOGRAPHY = {
  headingCase: "none",

  // Homepage hero typography.
  publicHeroH1Size: "56px",
  publicHeroH1Weight: 400,
  publicHeroH1LineHeight: "1.02",
  publicHeroH1LetterSpacing: "-0.02em",

  publicHeroH2Size: "30px",
  publicHeroH2Weight: 400,
  publicHeroH2LineHeight: "1.05",
  publicHeroH2LetterSpacing: "-0.02em",

  publicHeroParagraphSize: "1.05rem",
  publicHeroParagraphWeight: 400,
  publicHeroParagraphLineHeight: "1.1",

  publicPageH1Size: "52px",
  publicPageH1Weight: 320,
  publicPageH1LineHeight: "1.05",
  publicPageH1LetterSpacing: "-0.02em",

  publicSectionH2Size: "30px",
  publicSectionH2Weight: 600,
  publicSectionH2LineHeight: "1.08",
  publicSectionH2LetterSpacing: "-0.02em",

  publicSectionH3Size: "22px",
  publicSectionH3Weight: 600,
  publicSectionH3LineHeight: "1.15",
  publicSectionH3LetterSpacing: "-0.015em",

  publicEyebrowSize: "0.75rem",
  publicEyebrowWeight: 600,
  publicEyebrowLetterSpacing: "0.28em",

  publicUspSize: "0.75rem",
  publicUspWeight: 500,
  publicUspLineHeight: "1.3",
  publicUspLetterSpacing: "0.08em",

  publicRichH2Size: "30px",
  publicRichH2Weight: 600,
  publicRichH2LineHeight: "1.1",
  publicRichH2LetterSpacing: "-0.02em",

  publicRichH3Size: "22px",
  publicRichH3Weight: 600,
  publicRichH3LineHeight: "1.15",
  publicRichH3LetterSpacing: "-0.015em",

  adminPageTitleSize: "30px",
  adminPageTitleWeight: 600,
  adminPageTitleLineHeight: "1.1",
  adminPageTitleLetterSpacing: "-0.02em",

  adminSectionTitleSize: "24px",
  adminSectionTitleWeight: 600,
  adminSectionTitleLineHeight: "1.15",
  adminSectionTitleLetterSpacing: "-0.02em",

  adminSubsectionTitleSize: "18px",
  adminSubsectionTitleWeight: 600,
  adminSubsectionTitleLineHeight: "1.2",
  adminSubsectionTitleLetterSpacing: "-0.01em",

  adminCardTitleSize: "16px",
  adminCardTitleWeight: 600,
  adminCardTitleLineHeight: "1.25",
  adminCardTitleLetterSpacing: "0",
} as const;

export const TYPOGRAPHY_STYLE_VARS: CSSProperties = {
  "--type-heading-case": TYPOGRAPHY.headingCase,

  "--type-public-hero-h1-size-mobile": MOBILE_TYPOGRAPHY.publicHeroH1Size,
  "--type-public-hero-h1-size-desktop": TYPOGRAPHY.publicHeroH1Size,
  "--type-public-hero-h1-weight-mobile": MOBILE_TYPOGRAPHY.publicHeroH1Weight,
  "--type-public-hero-h1-weight-desktop": TYPOGRAPHY.publicHeroH1Weight,
  "--type-public-hero-h1-line-height-mobile": MOBILE_TYPOGRAPHY.publicHeroH1LineHeight,
  "--type-public-hero-h1-line-height-desktop": TYPOGRAPHY.publicHeroH1LineHeight,
  "--type-public-hero-h1-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicHeroH1LetterSpacing,
  "--type-public-hero-h1-letter-spacing-desktop": TYPOGRAPHY.publicHeroH1LetterSpacing,

  "--type-public-hero-h2-size-mobile": MOBILE_TYPOGRAPHY.publicHeroH2Size,
  "--type-public-hero-h2-size-desktop": TYPOGRAPHY.publicHeroH2Size,
  "--type-public-hero-h2-weight-mobile": MOBILE_TYPOGRAPHY.publicHeroH2Weight,
  "--type-public-hero-h2-weight-desktop": TYPOGRAPHY.publicHeroH2Weight,
  "--type-public-hero-h2-line-height-mobile": MOBILE_TYPOGRAPHY.publicHeroH2LineHeight,
  "--type-public-hero-h2-line-height-desktop": TYPOGRAPHY.publicHeroH2LineHeight,
  "--type-public-hero-h2-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicHeroH2LetterSpacing,
  "--type-public-hero-h2-letter-spacing-desktop": TYPOGRAPHY.publicHeroH2LetterSpacing,

  "--type-public-hero-p-size-mobile": MOBILE_TYPOGRAPHY.publicHeroParagraphSize,
  "--type-public-hero-p-size-desktop": TYPOGRAPHY.publicHeroParagraphSize,
  "--type-public-hero-p-weight-mobile": MOBILE_TYPOGRAPHY.publicHeroParagraphWeight,
  "--type-public-hero-p-weight-desktop": TYPOGRAPHY.publicHeroParagraphWeight,
  "--type-public-hero-p-line-height-mobile": MOBILE_TYPOGRAPHY.publicHeroParagraphLineHeight,
  "--type-public-hero-p-line-height-desktop": TYPOGRAPHY.publicHeroParagraphLineHeight,

  "--type-public-page-h1-size-mobile": MOBILE_TYPOGRAPHY.publicPageH1Size,
  "--type-public-page-h1-size-desktop": TYPOGRAPHY.publicPageH1Size,
  "--type-public-page-h1-weight-mobile": MOBILE_TYPOGRAPHY.publicPageH1Weight,
  "--type-public-page-h1-weight-desktop": TYPOGRAPHY.publicPageH1Weight,
  "--type-public-page-h1-line-height-mobile": MOBILE_TYPOGRAPHY.publicPageH1LineHeight,
  "--type-public-page-h1-line-height-desktop": TYPOGRAPHY.publicPageH1LineHeight,
  "--type-public-page-h1-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicPageH1LetterSpacing,
  "--type-public-page-h1-letter-spacing-desktop": TYPOGRAPHY.publicPageH1LetterSpacing,

  "--type-public-section-h2-size-mobile": MOBILE_TYPOGRAPHY.publicSectionH2Size,
  "--type-public-section-h2-size-desktop": TYPOGRAPHY.publicSectionH2Size,
  "--type-public-section-h2-weight-mobile": MOBILE_TYPOGRAPHY.publicSectionH2Weight,
  "--type-public-section-h2-weight-desktop": TYPOGRAPHY.publicSectionH2Weight,
  "--type-public-section-h2-line-height-mobile": MOBILE_TYPOGRAPHY.publicSectionH2LineHeight,
  "--type-public-section-h2-line-height-desktop": TYPOGRAPHY.publicSectionH2LineHeight,
  "--type-public-section-h2-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicSectionH2LetterSpacing,
  "--type-public-section-h2-letter-spacing-desktop": TYPOGRAPHY.publicSectionH2LetterSpacing,

  "--type-public-section-h3-size-mobile": MOBILE_TYPOGRAPHY.publicSectionH3Size,
  "--type-public-section-h3-size-desktop": TYPOGRAPHY.publicSectionH3Size,
  "--type-public-section-h3-weight-mobile": MOBILE_TYPOGRAPHY.publicSectionH3Weight,
  "--type-public-section-h3-weight-desktop": TYPOGRAPHY.publicSectionH3Weight,
  "--type-public-section-h3-line-height-mobile": MOBILE_TYPOGRAPHY.publicSectionH3LineHeight,
  "--type-public-section-h3-line-height-desktop": TYPOGRAPHY.publicSectionH3LineHeight,
  "--type-public-section-h3-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicSectionH3LetterSpacing,
  "--type-public-section-h3-letter-spacing-desktop": TYPOGRAPHY.publicSectionH3LetterSpacing,

  "--type-public-eyebrow-size-mobile": MOBILE_TYPOGRAPHY.publicEyebrowSize,
  "--type-public-eyebrow-size-desktop": TYPOGRAPHY.publicEyebrowSize,
  "--type-public-eyebrow-weight-mobile": MOBILE_TYPOGRAPHY.publicEyebrowWeight,
  "--type-public-eyebrow-weight-desktop": TYPOGRAPHY.publicEyebrowWeight,
  "--type-public-eyebrow-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicEyebrowLetterSpacing,
  "--type-public-eyebrow-letter-spacing-desktop": TYPOGRAPHY.publicEyebrowLetterSpacing,

  "--type-public-usp-size-mobile": MOBILE_TYPOGRAPHY.publicUspSize,
  "--type-public-usp-size-desktop": TYPOGRAPHY.publicUspSize,
  "--type-public-usp-weight-mobile": MOBILE_TYPOGRAPHY.publicUspWeight,
  "--type-public-usp-weight-desktop": TYPOGRAPHY.publicUspWeight,
  "--type-public-usp-line-height-mobile": MOBILE_TYPOGRAPHY.publicUspLineHeight,
  "--type-public-usp-line-height-desktop": TYPOGRAPHY.publicUspLineHeight,
  "--type-public-usp-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicUspLetterSpacing,
  "--type-public-usp-letter-spacing-desktop": TYPOGRAPHY.publicUspLetterSpacing,

  "--type-public-rich-h2-size-mobile": MOBILE_TYPOGRAPHY.publicRichH2Size,
  "--type-public-rich-h2-size-desktop": TYPOGRAPHY.publicRichH2Size,
  "--type-public-rich-h2-weight-mobile": MOBILE_TYPOGRAPHY.publicRichH2Weight,
  "--type-public-rich-h2-weight-desktop": TYPOGRAPHY.publicRichH2Weight,
  "--type-public-rich-h2-line-height-mobile": MOBILE_TYPOGRAPHY.publicRichH2LineHeight,
  "--type-public-rich-h2-line-height-desktop": TYPOGRAPHY.publicRichH2LineHeight,
  "--type-public-rich-h2-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicRichH2LetterSpacing,
  "--type-public-rich-h2-letter-spacing-desktop": TYPOGRAPHY.publicRichH2LetterSpacing,

  "--type-public-rich-h3-size-mobile": MOBILE_TYPOGRAPHY.publicRichH3Size,
  "--type-public-rich-h3-size-desktop": TYPOGRAPHY.publicRichH3Size,
  "--type-public-rich-h3-weight-mobile": MOBILE_TYPOGRAPHY.publicRichH3Weight,
  "--type-public-rich-h3-weight-desktop": TYPOGRAPHY.publicRichH3Weight,
  "--type-public-rich-h3-line-height-mobile": MOBILE_TYPOGRAPHY.publicRichH3LineHeight,
  "--type-public-rich-h3-line-height-desktop": TYPOGRAPHY.publicRichH3LineHeight,
  "--type-public-rich-h3-letter-spacing-mobile": MOBILE_TYPOGRAPHY.publicRichH3LetterSpacing,
  "--type-public-rich-h3-letter-spacing-desktop": TYPOGRAPHY.publicRichH3LetterSpacing,

  "--type-admin-page-title-size": TYPOGRAPHY.adminPageTitleSize,
  "--type-admin-page-title-weight": TYPOGRAPHY.adminPageTitleWeight,
  "--type-admin-page-title-line-height": TYPOGRAPHY.adminPageTitleLineHeight,
  "--type-admin-page-title-letter-spacing": TYPOGRAPHY.adminPageTitleLetterSpacing,

  "--type-admin-section-title-size": TYPOGRAPHY.adminSectionTitleSize,
  "--type-admin-section-title-weight": TYPOGRAPHY.adminSectionTitleWeight,
  "--type-admin-section-title-line-height": TYPOGRAPHY.adminSectionTitleLineHeight,
  "--type-admin-section-title-letter-spacing": TYPOGRAPHY.adminSectionTitleLetterSpacing,

  "--type-admin-subsection-title-size": TYPOGRAPHY.adminSubsectionTitleSize,
  "--type-admin-subsection-title-weight": TYPOGRAPHY.adminSubsectionTitleWeight,
  "--type-admin-subsection-title-line-height": TYPOGRAPHY.adminSubsectionTitleLineHeight,
  "--type-admin-subsection-title-letter-spacing": TYPOGRAPHY.adminSubsectionTitleLetterSpacing,

  "--type-admin-card-title-size": TYPOGRAPHY.adminCardTitleSize,
  "--type-admin-card-title-weight": TYPOGRAPHY.adminCardTitleWeight,
  "--type-admin-card-title-line-height": TYPOGRAPHY.adminCardTitleLineHeight,
  "--type-admin-card-title-letter-spacing": TYPOGRAPHY.adminCardTitleLetterSpacing,
} as CSSProperties;
