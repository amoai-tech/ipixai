import styles from "../shoot-wizard-shell.module.css";

type Props = {
  objective: string; brief: string; lighting: string; setBackground: string; talent: string; crew: string; crewCount: string; studio: string; studioType: string; equipment: string; scheduleStartDate: string; scheduleEndDate: string; planError: string | null; scheduleError: string | null;
  onObjectiveChange: (value: string) => void; onBriefChange: (value: string) => void; onLightingChange: (value: string) => void; onSetBackgroundChange: (value: string) => void; onTalentChange: (value: string) => void; onCrewChange: (value: string) => void; onCrewCountChange: (value: string) => void; onStudioChange: (value: string) => void; onStudioTypeChange: (value: string) => void; onEquipmentChange: (value: string) => void; onScheduleStartDateChange: (value: string) => void; onScheduleEndDateChange: (value: string) => void;
};

export function WizardStepBrief(p: Props) {
  return <div className={styles.formStack}>
    <label className={styles.field}>Objective<input value={p.objective} onChange={(e) => p.onObjectiveChange(e.target.value)} /></label>
    <label className={styles.field}>Brief<textarea value={p.brief} onChange={(e) => p.onBriefChange(e.target.value)} rows={5} /></label>
    <label className={styles.field}>Lighting<input value={p.lighting} onChange={(e) => p.onLightingChange(e.target.value)} /></label>
    <label className={styles.field}>Set / background<input value={p.setBackground} onChange={(e) => p.onSetBackgroundChange(e.target.value)} /></label>
    <label className={styles.field}>Talent<input value={p.talent} onChange={(e) => p.onTalentChange(e.target.value)} /></label>
    <label className={styles.field}>Crew description<input value={p.crew} onChange={(e) => p.onCrewChange(e.target.value)} /></label>
    <label className={styles.field}>Crew size<input type="number" min="1" value={p.crewCount} onChange={(e) => p.onCrewCountChange(e.target.value)} /></label>
    <label className={styles.field}>Studio<input value={p.studio} onChange={(e) => p.onStudioChange(e.target.value)} /></label>
    <label className={styles.field}>Studio type<select value={p.studioType} onChange={(e) => p.onStudioTypeChange(e.target.value)}><option value="">Select studio type…</option><option value="rental">Rental</option><option value="owned">Owned</option><option value="location">Location</option><option value="outdoor">Outdoor</option></select></label>
    <label className={styles.field}>Equipment<input value={p.equipment} onChange={(e) => p.onEquipmentChange(e.target.value)} /></label>
    <label className={styles.field}>Schedule start<input type="date" value={p.scheduleStartDate} onChange={(e) => p.onScheduleStartDateChange(e.target.value)} /></label>
    <label className={styles.field}>Schedule end<input type="date" value={p.scheduleEndDate} onChange={(e) => p.onScheduleEndDateChange(e.target.value)} /></label>
    {p.scheduleError ? <p role="alert">{p.scheduleError}</p> : null}
    {p.planError ? <p role="alert">{p.planError}</p> : null}
  </div>;
}
