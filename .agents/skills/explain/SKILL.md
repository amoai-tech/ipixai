---
name: explain
description: Explain iPix code, PRs, errors, decisions, configs, or technical concepts in plain English with a concrete real-world analogy and grounded example. Use whenever the user asks what something means, how it works, why it matters, or wants an ELI5/developer explanation.
argument-hint: "<thing to explain> [--eli5|--dev] [--short]"
metadata:
  version: "1.0.0"
---

# /explain — make it easy to understand

Explain `$ARGUMENTS` from verified current evidence rather than memory.

## Ground first

- For code/files, use Graphify first when the graph exists, then inspect only the load-bearing files.
- For PRs, inspect the exact current PR head/diff/reviews.
- For Linear issues, use the full live task: `IPI-NNN · TASK-ID — Full Task Name`.
- For runtime/data claims, verify them when practical; otherwise label them `NOT VERIFIED`.

This skill is explain-only. Do not edit code, commit, push, mutate GitHub, or mutate production data.

## Response pattern

1. **The gist:** one plain-English sentence covering what it is and why it exists.
2. **Think of it like:** one accurate everyday analogy when it helps.
3. **How it works:** the smallest useful mechanism/sequence.
4. **Real iPix example:** use an actual shoot, Brand Hub, asset, PR, file, or verified value when useful.
5. **Why it matters:** the user/business consequence.
6. **One-line takeaway.**

Flags:
- `--eli5`: avoid technical terms where possible.
- `--dev`: precise peer-engineer explanation, still plain first.
- `--short`: keep to one screen.

Accuracy beats simplicity. Never smooth over a caveat, risk, uncertainty, or missing proof.
