export const SERVICE_FEE_RATE = 0.1;

export function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export function rating10(r: number): string {
  return (r / 10).toFixed(1);
}

export const CATEGORY_LABELS: Record<string, string> = {
  remote: "Remote tuning",
  dyno: "Dyno tuning",
  diagnostics: "Diagnostics",
  ecu: "ECU calibration",
  tcm: "TCM calibration",
  build_support: "Build support",
  race_setup: "Race setup",
};

// ===== Capability groups (5) — source of truth for UI =====
import {
  TUNING_TYPES as _TUNING_TYPES,
  ENGINES as _ENGINES,
  ECUS as _ECUS,
  FUELS as _FUELS,
  INDUCTION as _INDUCTION,
  APPLICATIONS as _APPLICATIONS,
} from "@shared/schema";

export const TUNING_TYPES = _TUNING_TYPES;
export const ENGINES = _ENGINES;
export const ECUS = _ECUS;
export const FUELS = _FUELS;
export const INDUCTION = _INDUCTION;
export const APPLICATIONS = _APPLICATIONS;

export const CAPABILITY_GROUPS = [
  { key: "tuning_type", label: "Tuning type", values: TUNING_TYPES, withPrice: true },
  { key: "engine",      label: "Engine",      values: ENGINES,      withPrice: false },
  { key: "ecu",         label: "ECU",         values: ECUS,         withPrice: false },
  { key: "fuel",        label: "Fuel",        values: FUELS,        withPrice: false },
  { key: "induction",   label: "Induction",   values: INDUCTION,    withPrice: false },
  { key: "application", label: "Application", values: APPLICATIONS, withPrice: false },
] as const;

export const TUNING_TYPE_LABELS: Record<string, string> = {
  dyno: "Dyno",
  street: "Street",
  track: "Track",
  remote: "Remote",
};

export function capabilityLabel(group: string, value: string): string {
  if (group === "tuning_type") return TUNING_TYPE_LABELS[value] ?? value;
  return value;
}

export const PLATFORMS = [
  { key: "GM", label: "GM / LS", blurb: "LS & LT swaps, boosted street cars" },
  { key: "Ford", label: "Ford", blurb: "Coyote, EcoBoost, Power Stroke" },
  { key: "Mopar", label: "Mopar", blurb: "Hemi, Hellcat, SRT" },
  { key: "BMW", label: "BMW", blurb: "N54/N55/B58 Euro tuning" },
  { key: "VW", label: "VW / Audi", blurb: "EA888, DSG, DCT calibration" },
  { key: "Subaru", label: "Subaru", blurb: "EJ & FA protunes" },
  { key: "Nissan", label: "Nissan", blurb: "RB, VR, VQ, GT-R" },
  { key: "Diesel", label: "Diesel", blurb: "Cummins, Duramax, Power Stroke" },
];

export function parseMakes(json: string | string[] | unknown): string[] {
  if (Array.isArray(json)) return json as string[];
  if (typeof json === "string") {
    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Map asset images shipped with the app for seed listings.
import dyno from "@/assets/hero-dyno.png";
import ecu from "@/assets/hero-ecu.png";
import shop from "@/assets/tuner-shop.png";
export const SEED_IMAGES: Record<string, string> = { dyno, ecu, shop };
export function listingImage(heroImage: string | null | undefined): string {
  if (heroImage && SEED_IMAGES[heroImage]) return SEED_IMAGES[heroImage];
  return shop;
}
