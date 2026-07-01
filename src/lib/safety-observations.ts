export const HAZARDS = [
  "Afzetting", "Chemicaliën", "Elektriciteit", "Gedrag", "Gereedschap",
  "Housekeeping", "Klimaat", "Omgevingsfactoren", "Onderhoud", "PBM gebruik",
  "Radioactiviteit", "Sanitair", "Signalisatie", "Tijdsdruk", "Vakmanschap",
  "Vergunning", "Verkeer", "Voorbereiding", "Werkinstructie",
  "Werkplekinrichting", "Afschermen tegen vonken",
] as const;

export const RISKS = [
  "Aanrijding", "Bedwelming/verstikking", "Beknelling", "Blootstelling",
  "Brand/explosie", "Duwen/trekken", "Geluidshinder", "Hittestress",
  "Hygiëne", "Instorting", "Snijden/steken", "Stoten",
  "Struikelen/uitglijden", "Tillen", "Trillingen", "Val van hoogte",
  "Vallende voorwerpen", "Verbranding/bevriezing", "Verdrinken",
  "Wegvliegende delen",
] as const;

export type SafetyObservationType = "mos" | "stop";

export const TYPE_LABELS: Record<SafetyObservationType, { title: string; short: string }> = {
  mos: { title: "MOS-melding", short: "MOS" },
  stop: { title: "STOP-reflex", short: "STOP" },
};
