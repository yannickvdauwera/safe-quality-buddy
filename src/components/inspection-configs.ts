import type { ChecklistConfig } from "@/components/ChecklistCreateForm";

export const WPI_CONFIG: ChecklistConfig = {
  reportType: "werkplekinspectie",
  captureSignature: true,
  employeePicker: {
    label: "Geïnspecteerde medewerker",
    required: true,
    fillNameKey: "observed_name",
    fillEmployerKey: "employer",
    fillFunctionKey: "observed_function",
  },
  titleTemplate: (h) =>
    `WPI — ${h.observed_name || "geobserveerde"}${h.worksite ? ` @ ${h.worksite}` : ""}`,
  headerFields: [
    { key: "date", label: "Datum en tijdstip", type: "datetime", required: true },
    { key: "observed_function", label: "Functie geobserveerde", type: "text", required: true },
    { key: "employer", label: "Werkgever", type: "text" },
    { key: "principal", label: "Opdrachtgever", type: "text", required: true },
    { key: "worksite", label: "Werflocatie(s)", type: "text", required: true },
    { key: "executor", label: "Uitvoerder WPI", type: "text", required: true },
  ],

  sections: [
    {
      title: "Categorie A — Werkomgeving & procedures",
      questions: [
        { key: "A1",  label: "A.1. Werken conform procedures/instructies?" },
        { key: "A2",  label: "A.2. Gebruik van de juiste PBM's en in goede staat?" },
        { key: "A3",  label: "A.3. LMRA uitgevoerd?" },
        { key: "A4",  label: "A.4. Noodprocedures bekend?" },
        { key: "A5",  label: "A.5. Aanwezige steigers gekeurd en op de juiste wijze gebruikt?" },
        { key: "A6",  label: "A.6. Gereedschappen gekeurd en geschikt voor gebruik?" },
        { key: "A7",  label: "A.7. Veilige vluchtroutes?" },
        { key: "A8",  label: "A.8. Housekeeping in orde?" },
        { key: "A9",  label: "A.9. Werkvergunning aanwezig en in orde?" },
        { key: "A10", label: "A.10. Is TRA/SWA gemaakt/aanwezig en gelezen?" },
        { key: "A11", label: "A.11. Zijn gasmetingen verricht en genoteerd?" },
        { key: "A12", label: "A.12. Entree/besloten ruimte vergunning en registratie aanwezig?" },
        { key: "A13", label: "A.13. Afzetting in orde?" },
      ],
    },
    {
      title: "Categorie B — De geïnspecteerde",
      questions: [
        { key: "B14", label: "B.14. Verzorging" },
        { key: "B15", label: "B.15. Actieve houding" },
        { key: "B16", label: "B.16. Communicatie en samenwerking" },
        { key: "B17", label: "B.17. Veiligheidspaspoort in orde?" },
      ],
    },
    {
      title: "Categorie C — Kleding & afspraken",
      questions: [
        { key: "C18", label: "C.18. Kleding conform kledingreglement?" },
        { key: "C19", label: "C.19. Contact met planning?" },
        { key: "C20", label: "C.20. Contact met leidinggevende?" },
        { key: "C21", label: "C.21. Tevredenheid kledingpakket" },
        { key: "C22", label: "C.22. Worden afspraken nagekomen?" },
      ],
    },
  ],
  extraTextFields: [
    { key: "nok_details", label: "Extra duiding bij de NOK aangevinkte items", placeholder: "NVT indien geen NOK's", rows: 3 },
    { key: "other_findings", label: "Overige vaststellingen", rows: 3 },
    { key: "positive_findings", label: "Positieve bevindingen", rows: 2 },
  ],
};

export const KWALITEIT_CONFIG: ChecklistConfig = {
  reportType: "kwaliteitscontrole",
  employeePicker: {
    label: "Geobserveerde medewerker",
    required: true,
    fillFirstNameKey: "first_name",
    fillLastNameKey: "last_name",
  },
  titleTemplate: (h) =>
    `KC — ${(h.first_name || "").trim()} ${(h.last_name || "").trim()}`.trim() +
    (h.worksite ? ` @ ${h.worksite}` : ""),
  headerFields: [
    { key: "date", label: "Datum", type: "date", required: true },
    { key: "worksite", label: "Werf / Locatie", type: "text", required: true },
    { key: "assessor", label: "Naam beoordeler", type: "text", required: true },
  ],

  sections: [
    { title: "PBMs", questions: [
      { key: "Q1", label: "1. Draagt iedereen de vereiste PBMs?" },
    ]},
    { title: "Materiaal — detectie", questions: [
      { key: "Q2", label: "2. Kent de BVW de werking van het detectietoestel? (alarminstellingen, meetcellen, actie bij alarm)" },
      { key: "Q3", label: "3. Is de correcte werking van het detectietoestel nagekeken?" },
      { key: "Q4", label: "4. Heeft de BVW het detectietoestel correct gepositioneerd? (windrichting/in de besloten ruimte)" },
    ]},
    { title: "Materiaal — portofoon", questions: [
      { key: "Q5", label: "5. Kent de BVW de werking van de portofoon?" },
      { key: "Q6", label: "6. Wordt de portofoon correct gebruikt? (beschermtas/volumeniveau/radiodiscipline)" },
    ]},
    { title: "Materiaal — veiligheidskoffer", questions: [
      { key: "Q7", label: "7. Is alle materiaal aanwezig in de veiligheidskoffer?" },
      { key: "Q8", label: "8. Is het materiaal gecontroleerd?" },
      { key: "Q9", label: "9. Kent de BVW de ademlucht-op-en-afzetprocedure?" },
    ]},
    { title: "Materiaal — andere", questions: [
      { key: "Q10", label: "10. Is al het gebruikte materiaal in goede staat/gekeurd?" },
    ]},
    { title: "Noodplan", questions: [
      { key: "Q11", label: "11. Kent de BVW de locaties van nood- en oogdouches in de omgeving?" },
      { key: "Q12", label: "12. Kent de BVW de locatie van de vast opgestelde brandbestrijdingsmiddelen in de omgeving?" },
      { key: "Q13", label: "13. Zijn de noodhulpmiddelen en vluchtwegen vrij van obstakels?" },
      { key: "Q14", label: "14. Kent de BVW de verschillende bedrijfsspecifieke alarmen?" },
      { key: "Q15", label: "15. Kent de BVW de directe communicatiemiddelen in noodgevallen (portofoon, spreektoestel, ...)?" },
      { key: "Q16", label: "16. Kent de BVW de noodnummers van het bedrijf?" },
      { key: "Q17", label: "17. Weet de BVW waar de EHBO-post zich bevindt?" },
      { key: "Q18", label: "18. Kent de BVW de verschillende vluchtwegen en verzamelplaatsen?" },
      { key: "Q19", label: "19. Kent de BVW de windrichting?" },
    ]},
    { title: "Algemene taken", questions: [
      { key: "Q20", label: "20. Heeft de BVW zich aangemeld?" },
      { key: "Q21", label: "21. Zijn de werkvergunningen in orde?" },
      { key: "Q22", label: "22. Kent de BVW de bedrijfsspecifieke procedures die van toepassing zijn?" },
      { key: "Q23", label: "23. Is er een startwerkbespreking gehouden met de betrokken personen voor aanvang der werken?" },
      { key: "Q24", label: "24. Is de BVW op de hoogte van de werkzaamheden die uitgevoerd (zullen) worden?" },
      { key: "Q25", label: "25. Is de BVW op de hoogte van de risico's in de werkomgeving?" },
      { key: "Q26", label: "26. Zijn er afspraken gemaakt inzake housekeeping? (aanspreken van contractoren)" },
    ]},
    { title: "Brandwacht", questions: [
      { key: "Q27", label: "27. Zijn de vereiste brandbestrijdingsmiddelen aanwezig op de werkplek? (zie werkvergunning)" },
      { key: "Q28", label: "28. Is al het brandbare materiaal uit de omgeving verwijderd/afgeschermd?" },
      { key: "Q29", label: "29. Is de omgeving correct afgeschermd? (opvang van vonken naast & evt onder, rioolroosters)" },
    ]},
    { title: "Veiligheidswacht bij betredingen", questions: [
      { key: "Q30", label: "30. Staat de veiligheidskoffer bij het mangat opgesteld?" },
      { key: "Q31", label: "31. Is het betredingslogblad correct ingevuld?" },
      { key: "Q32", label: "32. Is er voldoende ventilatie?" },
      { key: "Q33", label: "33. Wordt er correcte verlichting gebruikt in de besloten ruimte?" },
      { key: "Q34", label: "34. Is er een goede communicatiemethode afgestemd met de betreders?" },
      { key: "Q35", label: "35. Worden de elektrische toestellen correct gebruikt? (laagspanningstransfo/scheidingstransfo)" },
    ]},
    { title: "Kwaliteitseigenschappen", questions: [
      { key: "Q36", label: "36. Kan de BVW zelfstandig werken?" },
      { key: "Q37", label: "37. Is de BVW stipt? (begin van de dienst, na pauzes)" },
      { key: "Q38", label: "38. Rapporteert de BVW veiligheidsmeldingen aan zijn/haar leidinggevende?" },
      { key: "Q39", label: "39. Kan de BVW goed samenwerken met anderen? (communicatie)" },
      { key: "Q40", label: "40. Beschikt de BVW over de nodige vakkennis?" },
      { key: "Q41", label: "41. Beschikt de BVW over de juiste veiligheidsingesteldheid?" },
    ]},
  ],
  extraTextFields: [
    { key: "follow_up", label: "Zijn er op te volgen items?", rows: 3, required: true },
    { key: "overall", label: "Algemene beoordeling", rows: 3, required: true },
  ],
};
