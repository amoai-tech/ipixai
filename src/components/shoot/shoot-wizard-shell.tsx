"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { composeShootPlanForWizard } from "@/app/app/shoots/new/actions";
import type { ProductRef } from "@/lib/commerce/product-ref";
import type { ShootPlan } from "@/mastra/tools/plan-schema";

import { WizardStepBasics } from "./wizard/wizard-step-basics";
import { WizardStepBrief } from "./wizard/wizard-step-brief";
import { WizardStepDeliverables } from "./wizard/wizard-step-deliverables";
import { WizardStepShotList } from "./wizard/wizard-step-shot-list";
import { WizardStepBudget } from "./wizard/wizard-step-budget";
import { WizardStepConfirmation } from "./wizard/wizard-step-confirmation";
import type { WizardBrand } from "./wizard/wizard-types";
import styles from "./shoot-wizard-shell.module.css";

type Props = {
  brands: WizardBrand[];
  productRefs?: ProductRef[];
};

const EMPTY_PRODUCT_REFS: ProductRef[] = [];

function productRefsFingerprint(productRefs: ProductRef[]): string {
  return JSON.stringify(productRefs.map((ref) => [
    ref.provider,
    ref.providerProductId,
    ref.providerVariantId ?? null,
    ref.title,
    ref.variantTitle ?? null,
    ref.sku ?? null,
    ref.imageUrl ?? null,
  ]));
}

const STEPS = ["Basics", "Brief", "Deliverables", "Shot List", "Budget", "Confirmation"] as const;
export function ShootWizardShell({ brands, productRefs = EMPTY_PRODUCT_REFS }: Props) {
  const [step, setStep] = useState(0);
  const [brandId, setBrandId] = useState(brands.length === 1 ? brands[0].id : "");
  const [shootName, setShootName] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState("");
  const [location, setLocation] = useState("");
  const [objective, setObjective] = useState("");
  const [brief, setBrief] = useState("");
  const [lighting, setLighting] = useState("");
  const [setBackground, setSetBackground] = useState("");
  const [talent, setTalent] = useState("");
  const [crew, setCrew] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [studio, setStudio] = useState("");
  const [studioType, setStudioType] = useState("");
  const [equipment, setEquipment] = useState("");
  const [scheduleStartDate, setScheduleStartDate] = useState("");
  const [scheduleEndDate, setScheduleEndDate] = useState("");
  const [plan, setPlan] = useState<ShootPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [reviewStarted, setReviewStarted] = useState(false);
  const inputGenerationRef = useRef(0);
  const productRefsKey = productRefsFingerprint(productRefs);

  const invalidatePlan = () => { inputGenerationRef.current += 1; };
  const change = (setter: (value: string) => void) => (value: string) => { invalidatePlan(); setter(value); };

  useEffect(() => {
    setPlan(null);
    setPlanError(null);
    setReviewStarted(false);
  }, [brandId, brief, channels, crew, crewCount, equipment, lighting, location, mediaType, objective, productRefsKey,
    scheduleEndDate, scheduleStartDate, setBackground, shootName, studio, studioType, talent]);

  const crewSize = crewCount.trim() ? Number(crewCount) : Number.NaN;
  const basicsComplete = Boolean(brandId && shootName.trim() && channels.length && mediaType && location.trim());
  const scheduleRangeValid = Boolean(
    scheduleStartDate && scheduleEndDate && scheduleEndDate >= scheduleStartDate,
  );
  const scheduleError = scheduleStartDate && scheduleEndDate && !scheduleRangeValid
    ? "Schedule end must be on or after the start date."
    : null;
  const briefComplete = Boolean(
    objective.trim() && brief.trim() && lighting.trim() && setBackground.trim() && talent.trim() && crew.trim() &&
    Number.isInteger(crewSize) && crewSize >= 1 && studio.trim() && studioType && equipment.trim() &&
    scheduleRangeValid,
  );
  const canContinue = useMemo(() => {
    if (step === 0) return basicsComplete;
    if (step === 1) return briefComplete && !composing;
    if (step >= 2 && step < STEPS.length - 1) return Boolean(plan);
    return false;
  }, [basicsComplete, briefComplete, composing, plan, step]);

  const toggleChannel = (id: string) => {
    invalidatePlan();
    setChannels((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  async function composePlan() {
    const requestGeneration = inputGenerationRef.current;
    setComposing(true);
    setPlanError(null);
    try {
      const result = await composeShootPlanForWizard({
        channels, shootName: shootName.trim(), objective: objective.trim(), brief: brief.trim(),
        productNames: productRefs.map((ref) => ref.title), productRefs, mediaType, crewCount: crewSize, studioType,
        location: location.trim(), lighting: lighting.trim(), setBackground: setBackground.trim(), talent: talent.trim(),
        crew: crew.trim(), studio: studio.trim(), equipment: equipment.trim(), scheduleStartDate, scheduleEndDate,
      });
      if (requestGeneration !== inputGenerationRef.current) return;
      if (!result.ok) { setPlanError(result.error); return; }
      setPlan(result.plan);
      setStep(2);
    } catch {
      if (requestGeneration === inputGenerationRef.current) {
        setPlanError("The production plan could not be composed. Please try again.");
      }
    } finally {
      setComposing(false);
    }
  }

  function handleContinue() {
    if (step === 1) { void composePlan(); return; }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  }

  const currentStep = (() => {
    if (step === 0) return <WizardStepBasics brands={brands} brandId={brandId} shootName={shootName} mediaType={mediaType} location={location} channels={channels} onBrandChange={change(setBrandId)} onShootNameChange={change(setShootName)} onMediaTypeChange={change(setMediaType)} onLocationChange={change(setLocation)} onToggleChannel={toggleChannel} />;
    if (step === 1) return <WizardStepBrief objective={objective} brief={brief} lighting={lighting} setBackground={setBackground} talent={talent} crew={crew} crewCount={crewCount} studio={studio} studioType={studioType} equipment={equipment} scheduleStartDate={scheduleStartDate} scheduleEndDate={scheduleEndDate} planError={planError} scheduleError={scheduleError} onObjectiveChange={change(setObjective)} onBriefChange={change(setBrief)} onLightingChange={change(setLighting)} onSetBackgroundChange={change(setSetBackground)} onTalentChange={change(setTalent)} onCrewChange={change(setCrew)} onCrewCountChange={change(setCrewCount)} onStudioChange={change(setStudio)} onStudioTypeChange={change(setStudioType)} onEquipmentChange={change(setEquipment)} onScheduleStartDateChange={change(setScheduleStartDate)} onScheduleEndDateChange={change(setScheduleEndDate)} />;
    if (!plan) return <div className={styles.placeholder}>{composing ? <p>Composing the canonical production plan…</p> : <p>The canonical plan is not ready.</p>}</div>;
    if (step === 2) return <WizardStepDeliverables plan={plan} />;
    if (step === 3) return <WizardStepShotList plan={plan} />;
    if (step === 4) return <WizardStepBudget plan={plan} />;
    return <WizardStepConfirmation plan={plan} brandId={brandId} reviewStarted={reviewStarted} onReviewStart={() => setReviewStarted(true)} onReviewStartFailed={() => setReviewStarted(false)} />;
  })();

  return (
    <section className={styles.shell} data-testid="shoot-wizard-shell">
      <aside className={styles.rail}>
        <Link href="/app/shoots" className={styles.backLink}>← Shoots</Link>
        <ol className={styles.steps} aria-label="Shoot wizard steps">
          {STEPS.map((label, index) => <li key={label} className={styles.step} data-state={index === step ? "active" : index < step ? "complete" : "future"}><span className={styles.stepMarker} aria-hidden>{index < step ? "✓" : index + 1}</span><span>{label}</span></li>)}
        </ol>
      </aside>
      <div className={styles.workspace}>
        <p className={styles.eyebrow}>Step {step + 1} of {STEPS.length}</p>
        <h1 className={styles.title}>{STEPS[step]}</h1>
        {currentStep}
        <div className={styles.actions}>
          {step > 0 ? <button type="button" className={styles.secondary} onClick={() => setStep((value) => Math.max(0, value - 1))}>← Back</button> : <span />}
          {step < STEPS.length - 1 ? <button type="button" className={styles.primary} disabled={!canContinue} onClick={handleContinue}>{composing ? "Composing…" : "Continue →"}</button> : null}
        </div>
      </div>
    </section>
  );
}
