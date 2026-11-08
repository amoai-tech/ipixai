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

/**
 * Validate the exact staged Production deployment and the unchanged live alias.
 * Both the workflow and synthetic tests use this function; only the caller
 * owns network access. No success signal is emitted until every check passes.
 */
export async function verifyStagedProduction({
  staged, live, deploymentUrl, liveBefore, projectId, orgId, sha,
  fetchImpl = globalThis.fetch,
}, token) {
  // Secret dependency is explicit. Never send an undefined bearer credential.
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Vercel token is required for staged inspection");
  }
  const host = new URL(deploymentUrl).hostname;
  const inspectedHost = inspectedDeploymentHost(staged?.url);
  if (inspectedHost !== host || !staged?.id || staged.target !== "production" ||
      staged.readyState !== "READY") {
    throw new Error("Staged artifact is not a ready Production deployment");
  }
  const response = await fetchImpl(
    "https://api.vercel.com/v13/deployments/" + encodeURIComponent(staged.id) +
      "?teamId=" + encodeURIComponent(orgId),
    { headers: { Authorization: "Bearer " + token } },
  );
  if (!response.ok) throw new Error("Deployment lookup returned HTTP " + response.status);
  const actual = await response.json();
  if (actual.projectId !== projectId ||
      actual.meta?.githubCommitSha !== sha ||
      actual.target !== "production") {
    throw new Error("Staged artifact SHA/project differs from CI-tested release");
  }
  const liveHost = inspectedDeploymentHost(live?.url);
  if (liveHost !== inspectedDeploymentHost(liveBefore) || liveHost === inspectedHost) {
    throw new Error("Production alias changed during staging");
  }
  return liveHost;
}
