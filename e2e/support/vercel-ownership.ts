/**
 * Prove Vercel owns the origin before returning bypass headers or signing in.
 * A hostname pattern cannot prove team ownership, because team slugs may have
 * hyphens (for example, attacker-amo-agency).
 */
export type VercelOwnershipOptions = {
  token?: string;
  teamId?: string;
  projectId?: string;
  fetchImpl?: typeof fetch;
};

export async function verifyVercelDeploymentOwnership(
  candidate: string,
  {
    token = process.env.VERCEL_TOKEN,
    teamId = process.env.VERCEL_ORG_ID,
    projectId = process.env.VERCEL_PROJECT_ID,
    fetchImpl = globalThis.fetch,
  }: VercelOwnershipOptions = {},
): Promise<void> {
  let origin: URL;
  try {
    origin = new URL(candidate);
  } catch {
    throw new Error("E2E preview target is not a valid URL");
  }
  if (
    origin.protocol !== "https:" ||
    origin.origin !== candidate ||
    origin.username ||
    origin.password ||
    origin.port ||
    !origin.hostname.endsWith(".vercel.app")
  ) {
    throw new Error("E2E preview must be an exact HTTPS Vercel deployment origin");
  }
  if (!token?.trim() || !/^team_[A-Za-z0-9]+$/.test(teamId ?? "") ||
      !/^prj_[A-Za-z0-9]+$/.test(projectId ?? "")) {
    throw new Error("VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID are required to verify preview ownership");
  }

  // The hostname is a lookup key, not proof; verify the actual project identity.
  const endpoint = new URL(
    "https://api.vercel.com/v13/deployments/" + encodeURIComponent(origin.hostname),
  );
  endpoint.searchParams.set("teamId", teamId!);
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      headers: { Authorization: "Bearer " + token.trim() },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("Vercel deployment ownership lookup failed; no bypass credentials sent");
  }
  if (!response.ok) {
    throw new Error("Vercel deployment ownership lookup returned HTTP " + response.status + "; no bypass credentials sent");
  }
  let deployment: unknown;
  try {
    deployment = await response.json();
  } catch {
    throw new Error("Vercel deployment ownership response is invalid");
  }
  if (!deployment || typeof deployment !== "object") {
    throw new Error("Vercel deployment ownership response is invalid");
  }
  const record = deployment as {
    url?: unknown;
    projectId?: unknown;
    project?: { id?: unknown };
    readyState?: unknown;
  };
  if (
    record.url !== origin.hostname ||
    (record.projectId ?? record.project?.id) !== projectId ||
    record.readyState !== "READY"
  ) {
    throw new Error("E2E preview does not belong to the expected READY Vercel project");
  }
}
