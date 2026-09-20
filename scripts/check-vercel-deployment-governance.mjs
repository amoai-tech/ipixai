import { pathToFileURL } from "node:url";

function readConfig(env) {
  const required = ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"];
  for (const key of required) {
    if (!env[key]) throw new Error(`${key} is required`);
  }

  const max24h = Number(env.VERCEL_MAX_DEPLOYMENTS_24H ?? "3");
  if (!Number.isInteger(max24h) || max24h < 0) {
    throw new Error("VERCEL_MAX_DEPLOYMENTS_24H must be a non-negative integer");
  }

  return {
    token: env.VERCEL_TOKEN,
    teamId: env.VERCEL_ORG_ID,
    projectId: env.VERCEL_PROJECT_ID,
    max24h,
  };
}

async function getJson(url, headers, fetchImpl) {
  const response = await fetchImpl(url, { method: "GET", headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

export async function listDeployments24h({ fetchImpl, token, teamId, projectId, since, pageLimit = 100 }) {
  const headers = { Authorization: `Bearer ${token}` };
  const deployments = [];
  const seenCursors = new Set();
  let until;

  for (let page = 0; page < 1000; page += 1) {
    const url = new URL("https://api.vercel.com/v7/deployments");
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("teamId", teamId);
    url.searchParams.set("since", String(since));
    url.searchParams.set("limit", String(pageLimit));
    if (until !== undefined) url.searchParams.set("until", until);

    const listed = await getJson(url, headers, fetchImpl);
    const pageDeployments = Array.isArray(listed.deployments) ? listed.deployments : [];
    deployments.push(...pageDeployments);

    const next = listed.pagination?.next;
    if (next === null || next === undefined) return deployments;

    const cursor = String(next);
    if (seenCursors.has(cursor)) throw new Error(`Vercel deployment pagination repeated cursor ${cursor}`);
    seenCursors.add(cursor);
    until = cursor;
  }

  throw new Error("Vercel deployment pagination exceeded 1000 pages");
}

function summarize(projectId, deployments, max24h) {
  const byTarget = {};
  for (const deployment of deployments) {
    const target = deployment.target ?? "unknown";
    byTarget[target] = (byTarget[target] ?? 0) + 1;
  }

  const unexpectedSources = deployments
    .filter((deployment) => deployment.source !== "cli")
    .map((deployment) => ({
      id: deployment.uid ?? deployment.id ?? "unknown",
      source: deployment.source ?? "unknown",
      target: deployment.target ?? "unknown",
      url: deployment.url ?? null,
    }));

  return {
    projectId,
    deployments24h: deployments.length,
    maxDeployments24h: max24h,
    byTarget,
    unexpectedSources,
  };
}

export async function runGovernance({
  env = process.env,
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  log = console.log,
  error = console.error,
} = {}) {
  try {
    const { token, teamId, projectId, max24h } = readConfig(env);
    if (typeof fetchImpl !== "function") throw new Error("global fetch is unavailable");

    const since = now - 24 * 60 * 60 * 1000;
    const deployments = await listDeployments24h({ fetchImpl, token, teamId, projectId, since });
    const summary = summarize(projectId, deployments, max24h);
    log(JSON.stringify(summary, null, 2));

    let failed = false;
    if (deployments.length > max24h) {
      failed = true;
      error(`::error title=Vercel deployment volume exceeded::${deployments.length} deployments were created in the last 24h; policy allows ${max24h}.`);
    }

    if (summary.unexpectedSources.length > 0) {
      failed = true;
      error(`::error title=Unexpected Vercel deployment source::Expected every iPix deployment to be CLI-owned; found ${summary.unexpectedSources.length} deployment(s) from another source.`);
    }

    if (!failed) log(`Vercel governance OK: ${deployments.length}/${max24h} deployments in 24h, all source=cli.`);
    return { exitCode: failed ? 1 : 0, summary };
  } catch (cause) {
    error(`::error title=Vercel governance check failed::${cause instanceof Error ? cause.message : String(cause)}`);
    return { exitCode: 2, summary: null };
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const result = await runGovernance();
  process.exitCode = result.exitCode;
}
