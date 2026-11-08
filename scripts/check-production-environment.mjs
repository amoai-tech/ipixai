/**
 * Fail closed before any paid Vercel Production QA if GitHub environment
 * protections changed. iPix is a public repo, so the GitHub REST API can be
 * checked read-only without introducing a privileged admin token.
 *
 * Reference — REFERENCE ONLY:
 * https://docs.github.com/en/rest/deployments/environments#get-an-environment
 * https://docs.github.com/en/rest/deployments/branch-policies#list-deployment-branch-policies
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const environmentUrl =
  "https://api.github.com/repos/amoai-tech/ipixai/environments/Production";
const branchPolicyUrl = environmentUrl + "/deployment-branch-policies";

export async function verifyProductionEnvironment({ fetchImpl = globalThis.fetch } = {}) {
  async function readGitHub(url) {
    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new Error("Production approval policy could not be read from GitHub");
    }
    if (!response.ok) {
      throw new Error("Production approval policy lookup failed (HTTP " + response.status + ")");
    }
    try {
      return await response.json();
    } catch {
      throw new Error("Production approval policy response is not JSON");
    }
  }

  const environment = await readGitHub(environmentUrl);
  const review = environment?.protection_rules?.filter(
    (rule) => rule?.type === "required_reviewers",
  );
  const reviewers = review?.[0]?.reviewers;
  if (
    environment?.name !== "Production" ||
    environment.can_admins_bypass !== false ||
    !Array.isArray(review) || review.length !== 1 ||
    !Array.isArray(reviewers) || reviewers.length !== 1 ||
    reviewers[0]?.type !== "User" ||
    reviewers[0]?.reviewer?.login !== "amoai-tech" ||
    reviewers[0]?.reviewer?.id !== 320616881 ||
    environment.deployment_branch_policy?.custom_branch_policies !== true ||
    environment.deployment_branch_policy?.protected_branches !== false
  ) {
    throw new Error("Production approval required reviewer, admin-bypass or branch policy drifted");
  }

  const branchPolicies = await readGitHub(branchPolicyUrl);
  if (
    branchPolicies?.total_count !== 1 ||
    !Array.isArray(branchPolicies.branch_policies) ||
    branchPolicies.branch_policies.length !== 1 ||
    branchPolicies.branch_policies[0]?.type !== "branch" ||
    branchPolicies.branch_policies[0]?.name !== "main"
  ) {
    throw new Error("Production approval branch policy must allow only main");
  }
  return true;
}

// The workflow invokes the same exported logic that the unit tests exercise.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await verifyProductionEnvironment();
    console.log("PASS: Production approval policy requires owner review, main-only, no admin bypass");
  } catch (error) {
    console.error(
      "::error title=Production approval gate drift::" +
      (error instanceof Error ? error.message : "Unknown approval policy failure") +
      ". STOP: restore GitHub Settings > Environments > Production. No paid QA started.",
    );
    process.exitCode = 1;
  }
}
