"use client";

import { z } from "zod";
import {
  createGenerativeUI,
  type GenerativeUIComponentProps,
} from "@copilotkit/react-core/v2/generative-ui";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Defense in depth for the FIRST qualitative-only pilot, not verification of
// business truth. Quantities, currencies, metrics, status claims and identifiers
// must come from a tenant-authorized server source (IPI-1428), never prose.
// A false positive hides a proposal rather than displaying an unverified fact.
const UNSUPPORTED_BUSINESS_CLAIMS = [
  /[\d$€£¥₹₱%]/u,
  /\b(?:USD|CAD|COP|EUR|GBP|budgets?|costs?|prices?|profits?|revenue|sales|conversions?|engagement|impressions?|metrics?|ROI|ROAS|KPIs?|percent(?:age)?s?|dollars?|pesos?|approved|published|completed|delivered|paid|spent|spending|shot\s+counts?|asset\s+IDs?)\b/iu,
  // Counted nouns. Singular "look" also means an outfit ("One Look at Nature"),
  // which is fashion vocabulary rather than an asset count, so only that exact
  // idiom is exempt. Plural "looks" is always a count ("twelve looks at the
  // beach" included), and a singular count ("one look for the editorial") still
  // fails, so the exemption cannot hide a real quantity.
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|dozen|hundred|thousand|million)\s+(?:shots?|images?|assets?|photos?|deliverables?|models?|items?|looks|look(?!\s+at\b))\b/iu,
];

// Trim first: min(1) alone accepts "   ", which would render an empty title or
// option while looking like a valid proposal.
const qualitativeText = (max: number) =>
  z.string().trim().min(1).max(max).refine(
    (text) => UNSUPPORTED_BUSINESS_CLAIMS.every((pattern) => !pattern.test(text)),
    "Only qualitative proposals are allowed; use authorized tools for business facts.",
  );

const conceptComparisonSchema = z.object({
  title: qualitativeText(120),
  options: z.array(z.object({
    name: qualitativeText(80),
    rationale: qualitativeText(280),
  }).strict()).min(2).max(3),
  note: qualitativeText(200).optional(),
}).strict();

/**
 * IPI-1387 · GENUI-CATALOG-001 — the first, deliberately small native GenUI
 * catalog. This pilot is read-only and qualitative: it never accepts prices,
 * budgets, shot counts, IDs or other numeric business facts from the model.
 * Those values require authorized tool/server data and belong to IPI-1428.
 */
export function ConceptComparison({
  title,
  options,
  note,
}: GenerativeUIComponentProps<typeof ipixGenerativeUI, "ConceptComparison">) {
  // A caller can bypass the catalog schema in tests or a future refactor.
  // Never render unverified quantified/status claims if invoked directly.
  if (!conceptComparisonSchema.safeParse({ title, options, note }).success) {
    return <p role="status" data-testid="genui-comparison-content-error">Comparison unavailable: unverified business details.</p>;
  }

  return (
    <Card
      className="border-[var(--border)] bg-[var(--card)]"
      data-testid="genui-concept-comparison"
    >
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <ul className="space-y-3">
          {options.map((option, index) => (
            <li key={`${option.name}-${index}`} className="space-y-1">
              <p className="text-sm font-medium">{option.name}</p>
              <p className="text-sm text-[var(--muted-foreground)]">{option.rationale}</p>
            </li>
          ))}
        </ul>
        {note ? (
          <p className="border-t border-[var(--border)] pt-2 text-xs text-[var(--muted-foreground)]">
            {note}
          </p>
        ) : null}
        <p className="text-[11px] text-[var(--muted-foreground)]">
          Proposed concepts — verify before production.
        </p>
      </CardContent>
    </Card>
  );
}

export const ipixGenerativeUI = createGenerativeUI({
  id: "ipix/planner@1",
  components: {
    ConceptComparison: {
      component: ConceptComparison,
      description:
        "A read-only qualitative comparison of two or three shoot concepts. Use only concept names and short rationales. Never include prices, budgets, shot counts, asset IDs or other measured business facts.",
      props: conceptComparisonSchema,
    },
  },
});
