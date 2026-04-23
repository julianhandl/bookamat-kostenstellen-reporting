/*
 * Static definitions of the Austrian E1a Kennzahlen.
 *
 * Labels and order copied verbatim from Bookamat's HTML E1a form
 * (see example_report_2025.html). Kennzahlen that are user-entered in
 * Bookamat (9259, 9221, 9227, 9229, 9276, 9277) are included for structural
 * completeness — this tool always reports them as zero in v1.
 */

export type KennzahlSection =
  | "betriebseinnahmen"
  | "betriebsausgaben"
  | "freibetraege";

export type KennzahlDefinition = {
  code: string;
  label: string;
  section: KennzahlSection;
};

export const KENNZAHLEN: KennzahlDefinition[] = [
  // Betriebseinnahmen
  {
    code: "9040",
    label: "Betriebseinnahmen (Leistungen & Waren)",
    section: "betriebseinnahmen",
  },
  {
    code: "9050",
    label:
      "Betriebseinnahmen die in einer Mitteilung gemäß §109a EStG erfasst sind",
    section: "betriebseinnahmen",
  },
  {
    code: "9060",
    label: "Verkauf & Entnahme von Anlagegütern",
    section: "betriebseinnahmen",
  },
  {
    code: "9090",
    label: "Übrige Betriebseinnahmen",
    section: "betriebseinnahmen",
  },

  // Betriebsausgaben
  {
    code: "9100",
    label: "Waren, Rohstoffe, Hilfsstoffe",
    section: "betriebsausgaben",
  },
  { code: "9110", label: "Fremdleistungen", section: "betriebsausgaben" },
  {
    code: "9120",
    label: "Personalaufwand für Angestellte",
    section: "betriebsausgaben",
  },
  {
    code: "9130",
    label:
      "Abschreibungen auf das Anlagevermögen (z.B. AfA, geringwertige Wirtschaftsgüter)",
    section: "betriebsausgaben",
  },
  {
    code: "9134",
    label: "Degressive Absetzung für Abnutzung (§ 7 Abs. 1a)",
    section: "betriebsausgaben",
  },
  {
    code: "9135",
    label: "Beschleunigte Gebäudeabschreibung (§ 8 Abs. 1a)",
    section: "betriebsausgaben",
  },
  {
    code: "9150",
    label: "Instandhaltung/Reinigung durch Fremdleister",
    section: "betriebsausgaben",
  },
  {
    code: "9160",
    label: "Reise- und Fahrtkosten inkl. Kilometergeld und Diäten",
    section: "betriebsausgaben",
  },
  {
    code: "9165",
    label:
      "Pauschale von 50% der Kosten einer Wochen-, Monats- oder Jahreskarte für Massenbeförderungsmittel",
    section: "betriebsausgaben",
  },
  {
    code: "9170",
    label: "Tatsächliche Kfz-Kosten ohne AfA, Leasing und Kilometergeld",
    section: "betriebsausgaben",
  },
  {
    code: "9180",
    label: "Miete und Pacht, Leasing",
    section: "betriebsausgaben",
  },
  {
    code: "9190",
    label: "Provisionen an Dritte, Lizenzgebühren",
    section: "betriebsausgaben",
  },
  {
    code: "9200",
    label: "Werbe- und Repräsentationskosten, Spenden",
    section: "betriebsausgaben",
  },
  {
    code: "9210",
    label: "Restbuchwerte abgegangener/verkaufter Anlagen",
    section: "betriebsausgaben",
  },
  {
    code: "9275",
    label: "Ausgaben/Aufwendungen für ein Arbeitszimmer",
    section: "betriebsausgaben",
  },
  {
    code: "9215",
    label: "Kleines Arbeitsplatzpauschale",
    section: "betriebsausgaben",
  },
  {
    code: "9216",
    label: "Ergonomisch geeignetes Mobiliar",
    section: "betriebsausgaben",
  },
  {
    code: "9217",
    label: "Großes Arbeitsplatzpauschale",
    section: "betriebsausgaben",
  },
  {
    code: "9220",
    label: "Zinsen und ähnliche Aufwendungen",
    section: "betriebsausgaben",
  },
  {
    code: "9225",
    label: "Sozialversicherungsbeiträge",
    section: "betriebsausgaben",
  },
  {
    code: "9243",
    label: "Betriebliche Spenden (begünstigte Einrichtungen)",
    section: "betriebsausgaben",
  },
  {
    code: "9244",
    label: "Betriebliche Spenden (mildtätige Organisationen)",
    section: "betriebsausgaben",
  },
  {
    code: "9245",
    label: "Betriebliche Spenden (Umwelt, Tiere)",
    section: "betriebsausgaben",
  },
  {
    code: "9246",
    label: "Betriebliche Spenden (Feuerwehren)",
    section: "betriebsausgaben",
  },
  {
    code: "9230",
    label: "Übrige Betriebsausgaben",
    section: "betriebsausgaben",
  },
  {
    code: "9259",
    label: "Pauschalierte Betriebsausgaben",
    section: "betriebsausgaben",
  },

  // Freibeträge — all always 0 in v1 (user-entered in Bookamat)
  { code: "9221", label: "Grundfreibetrag", section: "freibetraege" },
  {
    code: "9227",
    label: "Investitionsbedingter Gewinnfreibetrag für Wirtschaftsgüter",
    section: "freibetraege",
  },
  {
    code: "9229",
    label: "Investitionsbedingter Gewinnfreibetrag für Wertpapiere",
    section: "freibetraege",
  },
  {
    code: "9276",
    label: "Investitionsfreibetrag (10%)",
    section: "freibetraege",
  },
  {
    code: "9277",
    label: "Öko-Investitionsfreibetrag (15%)",
    section: "freibetraege",
  },
];
