export function getTrustedApplicationOrigin() {
  try {
    const configuredUrl = process.env.NEXTAUTH_URL;
    if (typeof configuredUrl !== 'string' || configuredUrl.length === 0)
      return null;
    if (
      /[\u0000-\u001f\u007f]/.test(configuredUrl) ||
      configuredUrl.includes('\\')
    )
      return null;
    const url = new URL(configuredUrl);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
