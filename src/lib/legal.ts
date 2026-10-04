import legal from './legal.json';

export type LegalDocId = 'terms' | 'guidelines' | 'privacy' | 'support';
export type LegalDoc = { title: string; intro: string; sections: { heading: string; body: string[] }[] };

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = legal.docs;
export const LEGAL_UPDATED = legal.updated;
export const SUPPORT_EMAIL = legal.contactEmail;

/** Where the same pages are published on the web (GitHub Pages from docs/, on the custom domain). */
export const LEGAL_WEB_BASE = 'https://outherenow.app';

/** Fill in the {contact} placeholder with the support email, or point to in-app support. */
export function fillContact(text: string): string {
  const contact = SUPPORT_EMAIL
    ? `Email ${SUPPORT_EMAIL}, or use Contact support on the Me tab in the app.`
    : 'Use Contact support on the Me tab in the app.';
  return text.replace('{contact}', contact);
}

export function isLegalDoc(id: string | undefined): id is LegalDocId {
  return id === 'terms' || id === 'guidelines' || id === 'privacy' || id === 'support';
}
