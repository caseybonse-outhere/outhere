import { router } from 'expo-router';
import { Platform, Share } from 'react-native';
import { LEGAL_WEB_BASE } from './legal';

export type ShareKind = 'camp' | 'spot';

/**
 * A normal https link that works anywhere (texts, Instagram bio, a printed QR code).
 * The web page (docs/open.html) hands off to the app at outhere://camp/<id> or outhere://spot/<id>.
 */
export function shareUrl(kind: ShareKind, id: string): string {
  return `${LEGAL_WEB_BASE}/open.html?${kind}=${encodeURIComponent(id)}`;
}

/** Open the system share sheet with a link to a camp or spot. */
export async function shareLink(kind: ShareKind, id: string, name: string, extra?: string) {
  const url = shareUrl(kind, id);
  const text = [`${name} on Out Here Now`, extra].filter(Boolean).join(' · ');
  // iOS shows the url as a rich link next to the message; Android only takes a message.
  await Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}` });
}

/** Full-screen QR code people can scan from a phone or a printed sign. */
export function showQr(kind: ShareKind, id: string, name: string) {
  router.push({ pathname: '/share', params: { kind, id, name } });
}
