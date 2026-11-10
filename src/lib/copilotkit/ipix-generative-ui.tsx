"use client";

import { z } from "zod";
import {
  createGenerativeUI,
  type GenerativeUIComponentProps,
} from "@copilotkit/react-core/v2/generative-ui";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          {options.map((option) => (
            <li key={option.name} className="space-y-1">
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
      props: z.object({
        title: z.string().min(1).max(120),
        options: z
          .array(
            z.object({
              name: z.string().min(1).max(80),
              rationale: z.string().min(1).max(280),
            })
            .strict(),
          )
          .min(2)
          .max(3),
        note: z.string().max(200).optional(),
      }).strict(),
    },
  },
});
