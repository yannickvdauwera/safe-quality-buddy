export type EvaluationSection = {
  key: string;
  title: string;
  items: { key: string; label: string }[];
};

export const EVALUATION_SECTIONS: EvaluationSection[] = [
  {
    key: "1",
    title: "1. Besluitvorming",
    items: [
      { key: "1.1", label: "De medewerker neemt juiste beslissingen en gebruikt hiervoor de juiste elementen" },
    ],
  },
  {
    key: "2",
    title: "2. Leerhouding & zelfredzaamheid",
    items: [
      { key: "2.1", label: "De medewerker staat open voor feedback." },
      { key: "2.2", label: "De medewerker vraagt actief feedback en stelt vragen." },
      { key: "2.3", label: "De medewerker past zich goed aan in verschillende situaties" },
      { key: "2.4", label: "De medewerker is zelfredzaam" },
      { key: "2.5", label: "De medewerker neemt verantwoordelijkheid binnen zijn functie" },
      { key: "2.6", label: "De medewerker is in het bezit van een attest IS-013" },
    ],
  },
  {
    key: "3",
    title: "3. Werkvergunningen & toezicht",
    items: [
      { key: "3.1", label: "De medewerker meldt zich correct aan" },
      { key: "3.2", label: "De medewerker laat zich informeren over de werkzaamheden waarop hij toezicht houdt" },
      { key: "3.3", label: "De medewerker is over het algemeen goed op de hoogte over de elementen van de werkvergunningen en de bijhorende (veiligheids)maatregelen." },
      { key: "3.4", label: "De medewerker volgt instructies op" },
    ],
  },
  {
    key: "4",
    title: "4. Communicatie & samenwerking",
    items: [
      { key: "4.1", label: "De medewerker kan zich in verschillende situaties verstaanbaar uitdrukken zonder de veiligheid in het gedrang te brengen." },
      { key: "4.2", label: "De medewerker toont respect voor de taal en cultuur van anderen" },
      { key: "4.3", label: "De medewerker communiceert correct naar externen en opdrachtgevers" },
      { key: "4.4", label: "De medewerker rapporteert correct naar de leidinggevende." },
      { key: "4.5", label: "De medewerker zet persoonlijke gevoelens opzij ten behoeve van de kwaliteit in de werkomgeving" },
      { key: "4.6", label: "De medewerker spreekt gedragingen en acties van anderen aan op een correcte manier" },
      { key: "4.7", label: "De medewerker slaagt erin conflicten constructief op te lossen" },
    ],
  },
  {
    key: "5",
    title: "5. Professionaliteit",
    items: [
      { key: "5.1", label: "De medewerker communiceert tijdig zijn afwezigheid" },
      { key: "5.2", label: "De medewerker is stipt" },
      { key: "5.3", label: "De medewerker vertegenwoordigt TSA op een correcte manier naar derden" },
      { key: "5.4", label: "De medewerker toont respect voor materialen" },
    ],
  },
  {
    key: "6",
    title: "6. Flexibiliteit",
    items: [
      { key: "6.1", label: "De medewerker is flexibel naar shiften" },
      { key: "6.2", label: "De medewerker lost correct af en springt bij tijdens de uren" },
    ],
  },
  {
    key: "7",
    title: "7. Veiligheid & kwaliteit",
    items: [
      { key: "7.1", label: "De medewerker gebruikt correct en consequent zijn PBMs" },
      { key: "7.2", label: "De medewerker geeft positief gevolg aan de actiepunten aangehaald tijdens toolboxmeetings en WPIs" },
      { key: "7.3", label: "De medewerker werkt actief mee aan risicoreductie (bv. LMRA)" },
      { key: "7.4", label: "De medewerker is bewust bezig met orde en netheid" },
      { key: "7.5", label: "De medewerker is bezig met de kwaliteit van de eigen werkzaamheden (scoort bijvoorbeeld goed bij WPIs/Observaties)" },
      { key: "7.6", label: "De medewerker meldt onveilig of irreguliere gebeurtenissen consequent volgens de procedure aan diens +1" },
    ],
  },
];

export const SCORE_OPTIONS: { value: string; label: string; short: string }[] = [
  { value: "3", label: "3 — Goed", short: "Goed" },
  { value: "2", label: "2 — Voldoende", short: "Voldoende" },
  { value: "1", label: "1 — Onvoldoende", short: "Onvoldoende" },
  { value: "0", label: "0 — Slecht", short: "Slecht" },
  { value: "na", label: "Niet kunnen beoordelen", short: "N.v.t." },
];

export const ALL_CRITERIA = EVALUATION_SECTIONS.flatMap((s) => s.items);

export function evaluationAverage(scores: Record<string, string>): number | null {
  const nums = Object.values(scores)
    .filter((v) => v !== "na" && v !== "" && v !== undefined && v !== null)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
