import { syncManagedFaqItems } from "@/lib/faqs";
import { syncManagedSitePages } from "@/lib/sitePages";
import { syncManagedTermsItems } from "@/lib/terms";

export async function syncManagedContent() {
  const [pages, faqs, terms] = await Promise.all([
    syncManagedSitePages(),
    syncManagedFaqItems(),
    syncManagedTermsItems(),
  ]);

  return {
    pagesSynced: pages.length,
    faqItemsSynced: faqs.length,
    termsItemsSynced: terms.length,
  };
}
