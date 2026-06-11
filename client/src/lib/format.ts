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
