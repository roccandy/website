import type { CSSProperties } from "react";

/**
 * Global typography controls.
 *
 * Update these values to adjust heading sizes, weights, spacing, and casing
 * across the public site and the main admin page titles.
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

  "--type-public-hero-h1-size": TYPOGRAPHY.publicHeroH1Size,
  "--type-public-hero-h1-weight": TYPOGRAPHY.publicHeroH1Weight,
  "--type-public-hero-h1-line-height": TYPOGRAPHY.publicHeroH1LineHeight,
  "--type-public-hero-h1-letter-spacing": TYPOGRAPHY.publicHeroH1LetterSpacing,

  "--type-public-hero-h2-size": TYPOGRAPHY.publicHeroH2Size,
  "--type-public-hero-h2-weight": TYPOGRAPHY.publicHeroH2Weight,
  "--type-public-hero-h2-line-height": TYPOGRAPHY.publicHeroH2LineHeight,
  "--type-public-hero-h2-letter-spacing": TYPOGRAPHY.publicHeroH2LetterSpacing,

  "--type-public-hero-p-size": TYPOGRAPHY.publicHeroParagraphSize,
  "--type-public-hero-p-weight": TYPOGRAPHY.publicHeroParagraphWeight,
  "--type-public-hero-p-line-height": TYPOGRAPHY.publicHeroParagraphLineHeight,

  "--type-public-page-h1-size": TYPOGRAPHY.publicPageH1Size,
  "--type-public-page-h1-weight": TYPOGRAPHY.publicPageH1Weight,
  "--type-public-page-h1-line-height": TYPOGRAPHY.publicPageH1LineHeight,
  "--type-public-page-h1-letter-spacing": TYPOGRAPHY.publicPageH1LetterSpacing,

  "--type-public-section-h2-size": TYPOGRAPHY.publicSectionH2Size,
  "--type-public-section-h2-weight": TYPOGRAPHY.publicSectionH2Weight,
  "--type-public-section-h2-line-height": TYPOGRAPHY.publicSectionH2LineHeight,
  "--type-public-section-h2-letter-spacing": TYPOGRAPHY.publicSectionH2LetterSpacing,

  "--type-public-section-h3-size": TYPOGRAPHY.publicSectionH3Size,
  "--type-public-section-h3-weight": TYPOGRAPHY.publicSectionH3Weight,
  "--type-public-section-h3-line-height": TYPOGRAPHY.publicSectionH3LineHeight,
  "--type-public-section-h3-letter-spacing": TYPOGRAPHY.publicSectionH3LetterSpacing,

  "--type-public-eyebrow-size": TYPOGRAPHY.publicEyebrowSize,
  "--type-public-eyebrow-weight": TYPOGRAPHY.publicEyebrowWeight,
  "--type-public-eyebrow-letter-spacing": TYPOGRAPHY.publicEyebrowLetterSpacing,

  "--type-public-rich-h2-size": TYPOGRAPHY.publicRichH2Size,
  "--type-public-rich-h2-weight": TYPOGRAPHY.publicRichH2Weight,
  "--type-public-rich-h2-line-height": TYPOGRAPHY.publicRichH2LineHeight,
  "--type-public-rich-h2-letter-spacing": TYPOGRAPHY.publicRichH2LetterSpacing,

  "--type-public-rich-h3-size": TYPOGRAPHY.publicRichH3Size,
  "--type-public-rich-h3-weight": TYPOGRAPHY.publicRichH3Weight,
  "--type-public-rich-h3-line-height": TYPOGRAPHY.publicRichH3LineHeight,
  "--type-public-rich-h3-letter-spacing": TYPOGRAPHY.publicRichH3LetterSpacing,

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
