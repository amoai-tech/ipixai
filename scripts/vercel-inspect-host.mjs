/**
 * Parse the URL field returned by a pinned Vercel CLI's inspect --json.
 * Fail closed for unknown shapes; only the deployment host is needed to
 * compare against the exact URL returned by our own staged deploy.
 *
 * Accepted: "ipixai-abc-amoco.vercel.app" or
 *           "https://ipixai-abc-amoco.vercel.app".
 */
export function inspectedDeploymentHost(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Vercel inspect url must be a nonempty string");
  }

  let parsed;
  try {
    parsed = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error("Vercel inspect url is malformed");
  }

  // An origin or bare hostname is safe to compare. Never accept paths,
  // query strings, credentials, alternate schemes, or unknown hostnames.
  if (
    parsed.protocol !== "https:" ||
    !/^[a-z0-9-]+\.vercel\.app$/.test(parsed.hostname) ||
    (value !== parsed.hostname && value !== parsed.origin)
  ) {
    throw new Error("Vercel inspect url is not a canonical deployment origin");
  }
  return parsed.hostname;
}
