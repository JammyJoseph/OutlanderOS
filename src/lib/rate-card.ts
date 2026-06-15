// Outlander's default rate card. These seed the RateCardPlacement table the
// first time the rate card is read; the media plan builder pre-fills a row's
// rate / impressions / rate type / measurement when a placement is selected.

export type RateType = "Flat Fee" | "Flat Post";
export type Measurement = "Impressions" | "Reach" | "N/A";

export interface RateCardEntry {
  name: string;
  rate: number;
  impressions: number;
  rateType: RateType;
  measurement: Measurement;
}

export const DEFAULT_RATE_CARD: RateCardEntry[] = [
  { name: "Outlander Magazine IG Post", rate: 3000, impressions: 50000, rateType: "Flat Post", measurement: "Impressions" },
  { name: "Outlander Magazine IG Story", rate: 1500, impressions: 30000, rateType: "Flat Post", measurement: "Impressions" },
  { name: "Outlander Magazine IG Bundle (Post + Stories)", rate: 4000, impressions: 70000, rateType: "Flat Fee", measurement: "Impressions" },
  { name: "Outlander Magazine IG Reel", rate: 3500, impressions: 60000, rateType: "Flat Post", measurement: "Impressions" },
  { name: "OPNLDR LAND IG Post", rate: 2500, impressions: 40000, rateType: "Flat Post", measurement: "Impressions" },
  { name: "OPNLDR LAND IG Bundle", rate: 5000, impressions: 80000, rateType: "Flat Fee", measurement: "Impressions" },
  { name: "Outlander Magazine Print Full Page", rate: 5000, impressions: 0, rateType: "Flat Fee", measurement: "N/A" },
  { name: "Outlander Magazine Print DPS", rate: 8000, impressions: 0, rateType: "Flat Fee", measurement: "N/A" },
  { name: "Outlander Website Banner", rate: 1500, impressions: 25000, rateType: "Flat Fee", measurement: "Impressions" },
  { name: "Newsletter Feature", rate: 2000, impressions: 15000, rateType: "Flat Fee", measurement: "Impressions" },
  { name: "Event Activation", rate: 10000, impressions: 0, rateType: "Flat Fee", measurement: "N/A" },
  { name: "Bespoke Content Production", rate: 15000, impressions: 0, rateType: "Flat Fee", measurement: "N/A" },
  // "Custom" is appended by the UI — it carries no defaults and lets the user
  // enter everything by hand. It is not stored as a rate-card row.
];

export const CUSTOM_PLACEMENT = "Custom";

export const RATE_TYPES: RateType[] = ["Flat Fee", "Flat Post"];
export const MEASUREMENTS: Measurement[] = ["Impressions", "Reach", "N/A"];
