export interface ToolboxContent {
  objective: string;
  hazards: string[];
  measures: string[];
  checklist: string[];
  questions: string[];
}

export const EMPTY_CONTENT: ToolboxContent = {
  objective: "",
  hazards: [],
  measures: [],
  checklist: [],
  questions: [],
};

export const TOOLBOX_CATEGORIES = [
  "Werken op hoogte",
  "Besloten ruimtes",
  "Chemische stoffen",
  "Elektrische veiligheid",
  "Persoonlijke beschermingsmiddelen",
  "Brandveiligheid",
  "Heftrucks & interne transportmiddelen",
  "Ergonomie & tillen",
  "Housekeeping",
  "Noodprocedures",
  "Algemeen",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Concept",
  published: "Gepubliceerd",
  archived: "Gearchiveerd",
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  planned: "Gepland",
  in_progress: "Bezig",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};
