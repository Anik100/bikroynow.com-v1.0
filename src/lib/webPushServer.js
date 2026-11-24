import * as webpush from 'web-push';

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BJOmaOksk0mUbNzIe1FiT34MpGAlus-RlYNnVwRCdT3dm_C_ny2BvFsLJzZET4MLRhL1CP4xlKks-WOYBvnlxmI';
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'pBiDgt0OxbZT6KM8xqM44t5ulj_cNL62smiHj7EBdGc';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@bikroynow.com';

try {
  if (typeof webpush.setVapidDetails === 'function') {
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  }
} catch (err) {
  console.warn('[WebPush] setVapidDetails error:', err);
}

export default webpush;
