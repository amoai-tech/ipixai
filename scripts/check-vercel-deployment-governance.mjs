import { pathToFileURL } from "node:url";

function readConfig(env) {
  for (const key of ["VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]) {
    if (!env[key]) throw new Error(`${key} is required`);
  }
  const max24h = Number(env.VERCEL_MAX_DEPLOYMENTS_24H ?? "3");
  if (!Number.isInteger(max24h) || max24h < 0) {
    throw new Error("VERCEL_MAX_DEPLOYMENTS_24H must be a non-negative integer");
  }
  return {token:env.VERCEL_TOKEN, teamId:env.VERCEL_ORG_ID, projectId:env.VERCEL_PROJECT_ID, max24h};
}

async function getJson(url, headers, fetchImpl) {
  const response = await fetchImpl(url, {method:"GET", headers});
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vercel deployment list HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

// Count distinct deployment attempts, NOT distinct Git SHAs. Retries, canceled
// builds, and failed builds consume resources and should remain visible.
// Vercel's source is optional/best-effort; do not infer 'cli' from its absence.
export async function listDeployments24h({fetchImpl, token, teamId, projectId, since, pageLimit=100}) {
  const headers = {Authorization:`Bearer ${token}`};
  const deployments=[];
  const seenIds=new Set();
  const seenCursors=new Set();
  let until;
  for (let page=0; page<1000; page+=1) {
    const url=new URL("https://api.vercel.com/v7/deployments");
    url.searchParams.set("projectId",projectId);
    url.searchParams.set("teamId",teamId);
    url.searchParams.set("since",String(since));
    url.searchParams.set("limit",String(pageLimit));
    if (until!==undefined) url.searchParams.set("until",until);
    const listed=await getJson(url,headers,fetchImpl);
    if (!Array.isArray(listed.deployments)) throw new Error("Vercel deployments list is not an array");
    for (const deployment of listed.deployments) {
      // Vercel also filters by since; guard against overlapping pages/old rows.
      const created=Number(deployment.created ?? deployment.createdAt);
      if (Number.isFinite(created) && created>0 && created<since) continue;
      const id=deployment.uid ?? deployment.id;
      if (id!=null && seenIds.has(id)) continue;
      if (id!=null) seenIds.add(id);
      deployments.push(deployment);
    }
    const next=listed.pagination?.next;
    if (next===null || next===undefined) return deployments;
    const cursor=String(next);
    if (seenCursors.has(cursor)) throw new Error(`Vercel deployment pagination repeated cursor ${cursor}`);
    seenCursors.add(cursor);
    until=cursor;
  }
  throw new Error("Vercel deployment pagination exceeded 1000 pages");
}

export function attributeDeployment(deployment) {
  // Vercel uses null target for Preview. Absent target property != null.
  const target=deployment.target===null
    ? (deployment.customEnvironmentId ? "custom" : "preview")
    : (typeof deployment.target==="string" && deployment.target ? deployment.target : "unknown");
  const source=typeof deployment.source==="string" && deployment.source ? deployment.source : "unreported";
  const meta=deployment.meta ?? {};
  const gitSha=typeof meta.githubCommitSha==="string" ? meta.githubCommitSha : null;
  const gitRef=typeof meta.githubCommitRef==="string" ? meta.githubCommitRef : null;
  const repo=typeof meta.githubRepo==="string" && typeof meta.githubOrg==="string"
    ? `${meta.githubOrg}/${meta.githubRepo}` : null;
  return {
    id:deployment.uid ?? deployment.id ?? null,
    target,
    source, // Only provider-reported method. Git metadata does not prove method.
    state:deployment.readyState ?? deployment.state ?? "unknown",
    created:deployment.created ?? deployment.createdAt ?? null,
    creator:typeof deployment.creator?.username==="string" ? deployment.creator.username : null,
    gitSha,gitRef,repo,url:deployment.url ?? null,
  };
}

function countBy(rows,field) {
  const totals={};
  for (const row of rows) totals[row[field]]=(totals[row[field]] ?? 0)+1;
  return totals;
}

export function summarize(projectId,deployments,max24h) {
  const attempts=deployments.map(attributeDeployment);
  const unexpectedSources=attempts.filter((r)=>r.target==="production" && r.source!=="cli");
  const unknownTargets=attempts.filter((r)=>r.target==="unknown");
  const unreportedSources=attempts.filter((r)=>r.source==="unreported");
  return {
    projectId,
    deployments24h:attempts.length, // All created: READY/ERROR/CANCELED all count.
    maxDeployments24h:max24h,
    byTarget:countBy(attempts,"target"),
    byState:countBy(attempts,"state"),
    bySource:countBy(attempts,"source"),
    unexpectedSources,
    unknownTargets,
    unreportedSources,
    attempts,
  };
}

export async function runGovernance({
  env=process.env, now=Date.now(), fetchImpl=globalThis.fetch,
  log=console.log, error=console.error,
}={}) {
  try {
    const {token,teamId,projectId,max24h}=readConfig(env);
    if (typeof fetchImpl!=="function") throw new Error("global fetch is unavailable");
    const since=now-24*60*60*1000;
    const deployments=await listDeployments24h({fetchImpl,token,teamId,projectId,since});
    const summary=summarize(projectId,deployments,max24h);
    log(JSON.stringify(summary,null,2));
    let failed=false;
    if (summary.deployments24h>max24h) {
      failed=true;
      error(`::error title=Vercel deployment volume exceeded::${summary.deployments24h} deployment attempts in 24h (including failed/canceled); limit is ${max24h}.`);
    }
    if (summary.unexpectedSources.length>0) {
      failed=true;
      error(`::error title=Unexpected Production deployment source::${summary.unexpectedSources.length} Production deployments were not reported as CLI-owned.`);
    }
    if (summary.unknownTargets.length>0) {
      failed=true;
      error(`::error title=Unclassified deployment environment::${summary.unknownTargets.length} deployments lack a verified target field.`);
    }
    if (summary.unreportedSources.length>0) {
      log(`::warning title=Vercel source unreported::${summary.unreportedSources.length} deployments have no source method; Git commit metadata is evidence of referenced code, not of how a deployment was initiated.`);
    }
    if (!failed) log(`Vercel governance OK: ${summary.deployments24h}/${max24h} attempts in 24h; no unexpected Production sources or unknown targets.`);
    return {exitCode:failed?1:0,summary};
  } catch(cause) {
    error(`::error title=Vercel governance check failed::${cause instanceof Error?cause.message:String(cause)}`);
    return {exitCode:2,summary:null};
  }
}
const isMain=process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href;
if (isMain) {const result=await runGovernance();process.exitCode=result.exitCode;}
