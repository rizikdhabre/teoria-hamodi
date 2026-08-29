const CALLBACK_FALLBACK = '/';
const MAX_CALLBACK_LENGTH = 2048;
const MAX_VALIDATION_DECODES = 4;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const URI_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const HTTP_ABSOLUTE_PATTERN = /^https?:\/\//i;

function parseHttpOrigin(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (CONTROL_CHARACTER_PATTERN.test(value) || value.includes('\\'))
    return null;
  const url = new URL(value);
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  )
    return null;
  return url.origin;
}

function hasUnsafeForm(value, allowHttpAbsolute) {
  return (
    CONTROL_CHARACTER_PATTERN.test(value) ||
    value.includes('\\') ||
    value.startsWith('//') ||
    (URI_SCHEME_PATTERN.test(value) &&
      !(allowHttpAbsolute && HTTP_ABSOLUTE_PATTERN.test(value)))
  );
}

function validateDecodedForms(candidate, allowHttpAbsolute = false) {
  let current = candidate;
  for (let pass = 0; pass < MAX_VALIDATION_DECODES; pass += 1) {
    if (hasUnsafeForm(current, allowHttpAbsolute)) return false;
    const decoded = decodeURIComponent(current);
    if (decoded === current) return true;
    current = decoded;
  }
  return false;
}

export function sanitizeCallbackUrl(candidate, trustedOrigin) {
  try {
    if (
      typeof candidate !== 'string' ||
      candidate.length === 0 ||
      candidate.length > MAX_CALLBACK_LENGTH
    ) {
      return CALLBACK_FALLBACK;
    }
    const origin = parseHttpOrigin(trustedOrigin);
    const isHttpAbsolute = HTTP_ABSOLUTE_PATTERN.test(candidate);
    if (!origin || !validateDecodedForms(candidate, isHttpAbsolute))
      return CALLBACK_FALLBACK;

    const resolved = new URL(candidate, origin);
    if (
      (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') ||
      resolved.origin !== origin ||
      resolved.username ||
      resolved.password
    )
      return CALLBACK_FALLBACK;

    const normalized = resolved.pathname + resolved.search + resolved.hash;
    if (
      !resolved.pathname.startsWith('/') ||
      resolved.pathname.startsWith('//') ||
      !validateDecodedForms(normalized)
    )
      return CALLBACK_FALLBACK;
    return normalized;
  } catch {
    return CALLBACK_FALLBACK;
  }
}
