import { buildDesignerPath } from "@/lib/designUrls";

export type InternalLinkOption = {
  label: string;
  href: string;
};

export const INTERNAL_LINK_OPTIONS: InternalLinkOption[] = [
  { label: "Homepage", href: "/" },
  { label: "About", href: "/about" },
  { label: "FAQs", href: "/faqs" },
  { label: "Blog", href: "/blog" },
  { label: "Design Your Candy", href: "/design" },
  { label: "Wedding Candy", href: "/design/wedding-candy" },
  { label: "Custom Text Candy", href: "/design/custom-text-candy" },
  { label: "Branded Candy", href: "/design/branded-logo-candy" },
  { label: "Pre-Made Candy", href: "/pre-made-candy" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
  { label: "Start Wedding Design", href: buildDesignerPath({ orderType: "weddings" }) },
  { label: "Start Text Design", href: buildDesignerPath({ orderType: "text" }) },
  { label: "Start Branded Design", href: buildDesignerPath({ orderType: "branded", categoryId: "branded" }) },
];

export const CUSTOM_INTERNAL_LINK_VALUE = "__custom__";
