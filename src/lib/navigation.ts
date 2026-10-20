const REVIEW_PAGE = /^\/prepare\/[A-Za-z0-9_-]{1,64}$/;

/**
 * Validates a `?returnTo=` value. Only links back to a review page are
 * accepted, so the parameter cannot be used to send users to another site.
 */
export function safeReturnTo(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && REVIEW_PAGE.test(candidate) ? candidate : undefined;
}
