/**
 * Rewrite stored media URLs so external platforms (Meta, TikTok, …) can fetch
 * them over HTTPS on our verified domain. Raw GCS object URLs are private to
 * Meta/TikTok crawlers even when our backend can read them with a service account.
 */
export function rewriteExternalMediaUrl(url: string): string {
  if (!url) {
    return url;
  }

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
  const gcsBucketName = process.env.GCS_BUCKET_NAME;
  if (!frontendUrl) {
    return url;
  }

  const toProxy = (objectPath: string) =>
    `${frontendUrl}/gcs-proxy/${objectPath.replace(/^\/+/, '')}`;

  if (gcsBucketName) {
    const gcsPrefix = `https://storage.googleapis.com/${gcsBucketName}/`;
    if (url.startsWith(gcsPrefix)) {
      return toProxy(url.slice(gcsPrefix.length).split('?')[0]!);
    }
  }

  try {
    const parsed = new URL(url);
    const isGcsHost =
      parsed.hostname === 'storage.googleapis.com' ||
      parsed.hostname === 'storage.cloud.google.com';

    if (isGcsHost && gcsBucketName) {
      const prefix = `/${gcsBucketName}/`;
      const idx = parsed.pathname.indexOf(prefix);
      if (idx >= 0) {
        const objectPath = parsed.pathname.slice(idx + prefix.length);
        if (objectPath) {
          return toProxy(decodeURIComponent(objectPath));
        }
      }
    }
  } catch {
    /* keep original url */
  }

  return url;
}
