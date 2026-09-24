import type { WizardBrand } from "./wizard-types";
import styles from "../shoot-wizard-shell.module.css";

const CHANNELS = [
  ["instagram_feed", "IG Feed"], ["instagram_story", "IG Story"], ["instagram_reel", "IG Reel"],
  ["tiktok", "TikTok"], ["pinterest", "Pinterest"], ["amazon", "Amazon"], ["shopify", "Shopify"],
  ["facebook", "Facebook"], ["youtube", "YouTube"], ["website", "Website"],
] as const;

type Props = {
  brands: WizardBrand[]; brandId: string; shootName: string; mediaType: string; location: string; channels: string[];
  onBrandChange: (value: string) => void; onShootNameChange: (value: string) => void;
  onMediaTypeChange: (value: string) => void; onLocationChange: (value: string) => void; onToggleChannel: (id: string) => void;
};

export function WizardStepBasics(props: Props) {
  return <div className={styles.formStack}>
    <label className={styles.field}>Brand<select value={props.brandId} onChange={(e) => props.onBrandChange(e.target.value)}><option value="">Select a brand…</option>{props.brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
    <label className={styles.field}>Shoot name<input value={props.shootName} onChange={(e) => props.onShootNameChange(e.target.value)} placeholder="SS26 Campaign" /></label>
    <label className={styles.field}>Media type<select value={props.mediaType} onChange={(e) => props.onMediaTypeChange(e.target.value)}><option value="">Select media…</option><option value="photo">Photo</option><option value="video">Video</option><option value="both">Photo + video</option></select></label>
    <label className={styles.field}>Location<input value={props.location} onChange={(e) => props.onLocationChange(e.target.value)} placeholder="Studio 1" /></label>
    <fieldset className={styles.channels}><legend>Target channels</legend><div className={styles.channelGrid}>{CHANNELS.map(([id, label]) => <label key={id} className={styles.channelChip}><input type="checkbox" checked={props.channels.includes(id)} onChange={() => props.onToggleChannel(id)} /><span>{label}</span></label>)}</div></fieldset>
  </div>;
}
