const required = ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`::error title=Vercel governance misconfigured::${key} is required`);
    process.exit(2);
  }
}

const max24h = Number(process.env.VERCEL_MAX_DEPLOYMENTS_24H ?? "3");
if (!Number.isInteger(max24h) || max24h < 0) {
  console.error("::error title=Invalid deployment budget::VERCEL_MAX_DEPLOYMENTS_24H must be a non-negative integer");
  process.exit(2);
}

const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;
const since = Date.now() - 24 * 60 * 60 * 1000;
const headers = { Authorization: `Bearer ${token}` };

async function getJson(url) {
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

const listUrl = new URL("https://api.vercel.com/v7/deployments");
listUrl.searchParams.set("projectId", projectId);
listUrl.searchParams.set("teamId", teamId);
listUrl.searchParams.set("since", String(since));
listUrl.searchParams.set("limit", "100");

try {
  const listed = await getJson(listUrl);
  const deployments = Array.isArray(listed.deployments) ? listed.deployments : [];
  const details = await Promise.all(
    deployments.map((deployment) => {
      const id = deployment.uid ?? deployment.id;
      const url = new URL(`https://api.vercel.com/v13/deployments/${encodeURIComponent(id)}`);
      url.searchParams.set("teamId", teamId);
      return getJson(url);
    }),
  );

  const unexpectedOwners = details.filter((deployment) => deployment.source !== "cli");
  const summary = {
    projectId,
    deployments24h: details.length,
    maxDeployments24h: max24h,
    byTarget: Object.fromEntries(
      [...new Set(details.map((deployment) => deployment.target ?? "unknown"))].map((target) => [
        target,
        details.filter((deployment) => (deployment.target ?? "unknown") === target).length,
      ]),
    ),
    unexpectedSources: unexpectedOwners.map((deployment) => ({
      id: deployment.id,
      source: deployment.source ?? "unknown",
      target: deployment.target ?? "unknown",
      url: deployment.url,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  let failed = false;
  if (details.length > max24h) {
    failed = true;
    console.error(
      `::error title=Vercel deployment volume exceeded::${details.length} deployments were created in the last 24h; policy allows ${max24h}.`,
    );
  }

  if (unexpectedOwners.length > 0) {
    failed = true;
    console.error(
      `::error title=Unexpected Vercel deployment source::Expected every iPix deployment to be CLI-owned; found ${unexpectedOwners.length} deployment(s) from another source.`,
    );
  }

  if (failed) process.exit(1);
  console.log(`Vercel governance OK: ${details.length}/${max24h} deployments in 24h, all source=cli.`);
} catch (error) {
  console.error(`::error title=Vercel governance check failed::${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
