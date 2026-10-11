import type {
  FacilityFilters,
  SortDirection,
  UNIT_METRICS,
} from "./facility-filters";

/**
 * Rubric §6 description-based search: turns a sentence such as "coal units in Kentucky with high CO2
 * in 2025" into explorer filters. Entity extraction, not sentence templates: known phrases (states,
 * fuels, unit types, controls, metrics, comparators, ranking words) are found anywhere and in any
 * order, numbers bind to the nearest metric, and anything left over is reported as unrecognized.
 * Pure (no database): the vocabulary comes from getFilterOptions, and "high"/"low" are returned as
 * qualitative terms for the server to resolve into percentile thresholds.
 */

export type Metric = (typeof UNIT_METRICS)[number]["key"];

export interface SearchVocab {
  states: string[];
  fuels: string[];
  secondaryFuels: string[];
  unitTypes: string[];
  so2Controls: string[];
  noxControls: string[];
  pmControls: string[];
  operatingStatuses: string[];
  counties: { county: string; stateCode: string }[];
}

export interface ParsedDescription {
  filters: Partial<FacilityFilters>;
  tab?: "explorer" | "units";
  sort?: { by: Metric; dir: SortDirection };
  qualitative: { metric: Metric; level: "high" | "low" }[];
  unrecognized: string[];
}

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  "washington dc": "DC",
  "puerto rico": "PR",
};

/** Lowercase two-letter codes that are also English words; these only count when typed in capitals. */
const AMBIGUOUS_CODES = new Set(
  "in or me oh ok hi la pa id co de al ma mo ne as".split(" "),
);

const METRIC_WORDS: Record<string, Metric> = {
  co2: "co2MassTons",
  carbon: "co2MassTons",
  "carbon dioxide": "co2MassTons",
  so2: "so2MassTons",
  sulfur: "so2MassTons",
  sulphur: "so2MassTons",
  "sulfur dioxide": "so2MassTons",
  nox: "noxMassTons",
  "nitrogen oxides": "noxMassTons",
  "nitrogen oxide": "noxMassTons",
  nitrogen: "noxMassTons",
  "heat input": "heatInputMMBtu",
  heat: "heatInputMMBtu",
  generation: "grossGenerationMWh",
  "gross generation": "grossGenerationMWh",
  "gross load": "grossGenerationMWh",
  load: "grossGenerationMWh",
  output: "grossGenerationMWh",
  mwh: "grossGenerationMWh",
  "operating time": "operatingHours",
  "operating hours": "operatingHours",
  hours: "operatingHours",
  hour: "operatingHours",
  hrs: "operatingHours",
  hr: "operatingHours",
  mmbtu: "heatInputMMBtu",
};

/** Pollutant-neutral mass units: they confirm a number is an amount but don't say which pollutant. */
const TON_WORDS = new Set([
  "tons",
  "ton",
  "tonnes",
  "tonne",
  "short tons",
  "t",
]);

const COMPARATORS: Record<string, "min" | "max" | "between"> = {
  ">": "min",
  ">=": "min",
  "≥": "min",
  "more than": "min",
  "greater than": "min",
  over: "min",
  above: "min",
  exceeding: "min",
  exceeds: "min",
  "at least": "min",
  "higher than": "min",
  "larger than": "min",
  "bigger than": "min",
  "no less than": "min",
  "<": "max",
  "<=": "max",
  "≤": "max",
  "less than": "max",
  "fewer than": "max",
  under: "max",
  below: "max",
  "at most": "max",
  "lower than": "max",
  "smaller than": "max",
  "no more than": "max",
  between: "between",
};
/** Comparators that exclude the bound ("over 500k" = > 500,000); the rest are inclusive. */
const STRICT_COMPARATORS = new Set([
  ">",
  "<",
  "more than",
  "greater than",
  "over",
  "above",
  "exceeding",
  "exceeds",
  "higher than",
  "larger than",
  "bigger than",
  "less than",
  "fewer than",
  "under",
  "below",
  "lower than",
  "smaller than",
]);

const RANK_WORDS: Record<string, SortDirection> = {
  top: "desc",
  highest: "desc",
  largest: "desc",
  biggest: "desc",
  most: "desc",
  greatest: "desc",
  maximum: "desc",
  max: "desc",
  dirtiest: "desc",
  bottom: "asc",
  lowest: "asc",
  least: "asc",
  smallest: "asc",
  fewest: "asc",
  minimum: "asc",
  min: "asc",
  cleanest: "asc",
};

const LEVEL_WORDS: Record<string, "high" | "low"> = {
  high: "high",
  heavy: "high",
  large: "high",
  big: "high",
  significant: "high",
  dirty: "high",
  low: "low",
  small: "low",
  little: "low",
  clean: "low",
  minimal: "low",
};

const VIEW_WORDS: Record<
  string,
  { tab: "explorer" | "units"; singular: boolean }
> = {
  unit: { tab: "units", singular: true },
  units: { tab: "units", singular: false },
  generator: { tab: "units", singular: true },
  generators: { tab: "units", singular: false },
  plant: { tab: "explorer", singular: true },
  plants: { tab: "explorer", singular: false },
  facility: { tab: "explorer", singular: true },
  facilities: { tab: "explorer", singular: false },
  station: { tab: "explorer", singular: true },
  stations: { tab: "explorer", singular: false },
  emitter: { tab: "explorer", singular: true },
  emitters: { tab: "explorer", singular: false },
};

const GROUP_PHRASES = [
  "per state",
  "in each state",
  "each state",
  "by state",
  "in every state",
  "every state",
  "for each state",
];
/** Words that introduce a plant or owner name, and words that end one. */
const NAME_MARKERS = new Set([
  "owned",
  "operated",
  "owner",
  "operator",
  "named",
  "called",
]);
const NAME_ENDS = new Set([
  "in",
  "with",
  "and",
  "since",
  "from",
  "that",
  "which",
  "where",
  "for",
  "during",
]);
const NEGATIONS = new Set([
  "not",
  "no",
  "without",
  "except",
  "excluding",
  "non",
]);
const YEAR_WORDS: Record<
  string,
  "since" | "after" | "before" | "until" | "to"
> = {
  since: "since",
  after: "after",
  before: "before",
  until: "until",
  through: "to",
  to: "to",
  thru: "to",
};

const STOPWORDS = new Set(
  `find show me list give get display search for all any the a an of in on at with that which who
  whose is are was were be been have has having and or by from what where please i want need see
  their its than emissions emission emitting emit emits fired burning burn burns using use uses
  powered generating electric electricity power data record records year years reporting reported
  annual yearly total mass amount amounts level levels state states county per each every sorted
  sort order ordered rank ranked ranking very quite really also like located based u.s us united
  america american mostly primarily primary fuel fuels type types control controls equipped
  technology named called`.split(/\s+/),
);

type Item =
  | { t: "filter"; key: keyof FacilityFilters; value: string; raw: string }
  | { t: "metric"; metric: Metric; raw: string }
  | { t: "tons"; raw: string }
  | { t: "cmp"; op: "min" | "max" | "between"; strict: boolean; raw: string }
  | { t: "num"; value: number; raw: string; yearLike: boolean }
  | { t: "rank"; dir: SortDirection; raw: string }
  | { t: "level"; level: "high" | "low"; raw: string }
  | { t: "view"; tab: "explorer" | "units"; singular: boolean; raw: string }
  | { t: "group"; raw: string }
  | {
      t: "yearword";
      op: "since" | "after" | "before" | "until" | "to";
      raw: string;
    }
  | { t: "and"; raw: string }
  | { t: "secondary"; raw: string };

type Action = Item | ((raw: string) => Item);

/** Optimal string alignment distance (Levenshtein + adjacent transposition), for typo tolerance. */
function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/** "500,000" · "500k" · "1.2M" · "1.2 million" · "5e5" → number; undefined if not a number. */
export function parseAmount(text: string): number | undefined {
  const m =
    /^(\d[\d,]*(?:\.\d+)?(?:e\d+)?)\s*(k|thousand|m|mm|million|b|bn|billion)?$/i.exec(
      text.trim(),
    );
  if (!m) return undefined;
  const base = Number(m[1]!.replace(/,/g, ""));
  const scale = {
    k: 1e3,
    thousand: 1e3,
    m: 1e6,
    mm: 1e6,
    million: 1e6,
    b: 1e9,
    bn: 1e9,
    billion: 1e9,
  }[(m[2] ?? "").toLowerCase() as "k"];
  return Number.isFinite(base) ? base * (scale ?? 1) : undefined;
}

const TOKEN_RE =
  /\d[\d,]*(?:\.\d+)?(?:e\d+)?(?:\s*(?:k|thousand|million|billion|mm|m|bn|b)\b)?|[<>]=?|[≥≤#]|[a-z][a-z0-9.']*|\d+[a-z][a-z0-9]*|[,;]/gi;

function tokenize(text: string) {
  const normalized = text
    .replace(/₂/g, "2")
    .replace(/ₓ/g, "x")
    .replace(/(\d{4})\s*[-–]\s*(\d{4})/g, "$1 to $2")
    .replace(/([a-z0-9])-(?=[a-z])/gi, "$1 ");
  return (normalized.match(TOKEN_RE) ?? []).map((raw) => ({
    raw: raw.replace(/[.']+$/, ""),
    low: raw.replace(/[.']+$/, "").toLowerCase(),
  }));
}

/** Phrase → action table built from the static words and the database's own filter values. */
function buildPhrases(vocab: SearchVocab) {
  const phrases = new Map<string, Action>();
  const add = (phrase: string, action: Action) => {
    const key = phrase.replace(/\./g, "");
    if (!phrases.has(key)) phrases.set(key, action);
  };
  const filter =
    (key: keyof FacilityFilters, value: string): Action =>
    (raw) => ({ t: "filter", key, value, raw });

  // Specific multi-word vocabulary first, so "pipeline natural gas" beats "gas".
  for (const v of vocab.unitTypes)
    add(v.toLowerCase().replace(/-/g, " "), filter("unitType", v));
  for (const v of vocab.so2Controls)
    if (v !== "Other") add(v.toLowerCase(), filter("so2Control", v));
  for (const v of vocab.noxControls)
    if (v !== "Other") add(v.toLowerCase(), filter("noxControl", v));
  for (const v of vocab.pmControls)
    if (v !== "Other") add(v.toLowerCase(), filter("pmControl", v));
  for (const v of vocab.fuels) add(v.toLowerCase(), filter("primaryFuel", v));
  for (const { county } of vocab.counties)
    add(county.toLowerCase(), filter("county", county));
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (vocab.states.includes(code)) add(name, filter("stateCode", code));
  }

  const synonyms: [string[], keyof FacilityFilters, string][] = [
    [["gas", "natural gas", "nat gas", "ng"], "primaryFuel", "Natural Gas"],
    [["oil", "fuel oil", "petroleum"], "primaryFuel", "Oil"],
    [["petcoke", "pet coke"], "primaryFuel", "Petroleum Coke"],
    [["biomass", "wood fired"], "primaryFuel", "Wood"],
    [
      ["combined cycle", "ccgt", "combined cycle gas turbine"],
      "unitType",
      "Combined cycle",
    ],
    [
      [
        "combustion turbine",
        "gas turbine",
        "simple cycle",
        "peaker",
        "peakers",
        "peaking",
      ],
      "unitType",
      "Combustion turbine",
    ],
    [["boiler", "boilers"], "unitType", "boiler"],
    [["kiln", "cement kiln"], "unitType", "Cement Kiln"],
    [
      ["cyclone boiler", "cyclone boilers", "cyclone"],
      "unitType",
      "Cyclone boiler",
    ],
    [
      ["scrubber", "scrubbers", "scrubbed", "fgd", "flue gas desulfurization"],
      "so2Control",
      "FGD",
    ],
    [
      ["scr", "selective catalytic reduction"],
      "noxControl",
      "Selective Catalytic Reduction",
    ],
    [["sncr"], "noxControl", "Selective Non-catalytic Reduction"],
    [
      ["low nox burner", "low nox burners", "lnb"],
      "noxControl",
      "Low NOx Burner",
    ],
    [["overfire air", "ofa"], "noxControl", "Overfire Air"],
    [
      ["baghouse", "baghouses", "fabric filter", "fabric filters"],
      "pmControl",
      "Baghouse",
    ],
    [
      ["esp", "electrostatic precipitator", "electrostatic precipitators"],
      "pmControl",
      "Electrostatic Precipitator",
    ],
    [
      ["operating", "active", "operational", "in service"],
      "operatingStatus",
      "Operating",
    ],
    [["retired", "decommissioned", "shut down"], "operatingStatus", "Retired"],
    [["future", "planned", "proposed"], "operatingStatus", "Future"],
    [
      ["cold storage", "mothballed"],
      "operatingStatus",
      "Long-term Cold Storage",
    ],
  ];
  for (const [words, key, value] of synonyms)
    for (const w of words) add(w, filter(key, value));

  for (const [w, metric] of Object.entries(METRIC_WORDS))
    add(w, (raw) => ({ t: "metric", metric, raw }));
  for (const w of TON_WORDS) add(w, (raw) => ({ t: "tons", raw }));
  for (const [w, op] of Object.entries(COMPARATORS))
    add(w, (raw) => ({ t: "cmp", op, strict: STRICT_COMPARATORS.has(w), raw }));
  for (const [w, dir] of Object.entries(RANK_WORDS))
    add(w, (raw) => ({ t: "rank", dir, raw }));
  for (const [w, level] of Object.entries(LEVEL_WORDS))
    add(w, (raw) => ({ t: "level", level, raw }));
  for (const [w, v] of Object.entries(VIEW_WORDS))
    add(w, (raw) => ({ t: "view", ...v, raw }));
  for (const w of GROUP_PHRASES) add(w, (raw) => ({ t: "group", raw }));
  for (const [w, op] of Object.entries(YEAR_WORDS))
    add(w, (raw) => ({ t: "yearword", op, raw }));
  for (const w of ["secondary", "backup", "secondary fuel", "backup fuel"])
    add(w, (raw) => ({ t: "secondary", raw }));
  add("and", (raw) => ({ t: "and", raw }));
  return phrases;
}

const MAX_PHRASE_WORDS = 6;
const isYearLike = (n: number, raw: string) =>
  Number.isInteger(n) && n >= 1990 && n <= 2035 && /^\d{4}$/.test(raw);

const resolve = (action: Action, raw: string) =>
  typeof action === "function" ? action(raw) : action;

/** Turns tokens into items: greedy longest phrase match, then numbers, state codes, IDs, typos. */
function toItems(text: string, vocab: SearchVocab) {
  const phrases = buildPhrases(vocab);
  // Typo tolerance only for filter values (states, fuels, types, controls), never for words like "lowest".
  const fuzzyKeys = [...phrases.entries()]
    .filter(
      ([k, action]) =>
        k.length >= 5 && !k.includes(" ") && resolve(action, k).t === "filter",
    )
    .map(([k]) => k);
  const tokens = tokenize(text);
  const items: Item[] = [];
  const unrecognized: string[] = [];
  let negate = false;

  const push = (item: Item) => {
    if (negate) {
      // The filters can't express NOT; report it instead of applying the opposite.
      unrecognized.push(`not ${item.raw}`);
      negate = false;
      return;
    }
    items.push(item);
  };

  for (let i = 0; i < tokens.length;) {
    const tok = tokens[i]!;

    // Names: "owned by Duke Energy", "named Gavin" → the explorer's name/owner/county text search.
    if (NAME_MARKERS.has(tok.low)) {
      let j = tokens[i + 1]?.low === "by" ? i + 2 : i + 1;
      const words: string[] = [];
      for (; j < tokens.length; j++) {
        const w = tokens[j]!;
        const action = phrases.get(w.low);
        if (
          w.raw === "," ||
          w.raw === ";" ||
          NAME_ENDS.has(w.low) ||
          parseAmount(w.raw) !== undefined ||
          (action && resolve(action, w.raw).t !== "filter")
        ) {
          break;
        }
        words.push(w.raw);
      }
      if (words.length) {
        push({
          t: "filter",
          key: "search",
          value: words.join(" "),
          raw: words.join(" "),
        });
        i = j;
        continue;
      }
    }

    // Facility / unit identifiers: "facility 3", "plant #1378", "ORISPL 3", "unit CT1".
    const next = tokens[i + 1];
    const afterHash = next?.raw === "#" ? tokens[i + 2] : next;
    const skip = next?.raw === "#" ? 3 : 2;
    if (
      ["facility", "plant", "orispl", "station"].includes(tok.low) &&
      afterHash &&
      /^\d+$/.test(afterHash.raw) &&
      !isYearLike(Number(afterHash.raw), afterHash.raw)
    ) {
      push({
        t: "filter",
        key: "facilityId",
        value: afterHash.raw,
        raw: `${tok.raw} ${afterHash.raw}`,
      });
      i += skip;
      continue;
    }
    if (
      tok.low === "unit" &&
      next &&
      /^[a-z]*\d[a-z0-9]*$/i.test(next.raw) &&
      !isYearLike(Number(next.raw), next.raw)
    ) {
      push({
        t: "filter",
        key: "unitId",
        value: next.raw,
        raw: `unit ${next.raw}`,
      });
      i += 2;
      continue;
    }

    let matched = false;
    for (
      let n = Math.min(MAX_PHRASE_WORDS, tokens.length - i);
      n >= 1 && !matched;
      n--
    ) {
      const words = tokens.slice(i, i + n);
      const phrase = words.map((w) => w.low).join(" ");
      const action = phrases.get(phrase);
      if (action) {
        push(resolve(action, words.map((w) => w.raw).join(" ")));
        i += n;
        matched = true;
      }
    }
    if (matched) continue;

    const amount = parseAmount(tok.raw);
    if (amount !== undefined) {
      push({
        t: "num",
        value: amount,
        raw: tok.raw,
        yearLike: isYearLike(amount, tok.raw),
      });
    } else if (/^[A-Z]{2}$/.test(tok.raw) && vocab.states.includes(tok.raw)) {
      push({ t: "filter", key: "stateCode", value: tok.raw, raw: tok.raw });
    } else if (
      /^[a-z]{2}$/.test(tok.raw) &&
      !AMBIGUOUS_CODES.has(tok.raw) &&
      vocab.states.includes(tok.raw.toUpperCase())
    ) {
      push({
        t: "filter",
        key: "stateCode",
        value: tok.raw.toUpperCase(),
        raw: tok.raw,
      });
    } else if (NEGATIONS.has(tok.low)) {
      negate = true;
    } else if (
      tok.raw === "," ||
      tok.raw === ";" ||
      tok.raw === "#" ||
      STOPWORDS.has(tok.low)
    ) {
      // punctuation and filler
    } else {
      // Typos: one edit (two for long words) away from a known phrase of 5+ letters.
      const limit = tok.low.length >= 9 ? 2 : 1;
      const near =
        tok.low.length >= 5 &&
        fuzzyKeys.find(
          (k) =>
            Math.abs(k.length - tok.low.length) <= limit &&
            editDistance(k, tok.low) <= limit,
        );
      if (near) push(resolve(phrases.get(near)!, tok.raw));
      else unrecognized.push(tok.raw);
    }
    i++;
  }
  if (negate) unrecognized.push("not");
  return { items, unrecognized };
}

const METRIC_UNITS = new Set<Item["t"]>(["metric", "tons"]);

/** Binds numbers, ranking, and "high/low" to metrics, and years to the year filters. */
export function parseDescription(
  text: string,
  vocab: SearchVocab,
): ParsedDescription {
  const { items, unrecognized } = toItems(text, vocab);
  const used = new Set<number>();
  const filters: Partial<FacilityFilters> = {};
  const qualitative: ParsedDescription["qualitative"] = [];
  let sort: ParsedDescription["sort"];
  let topN: number | undefined;
  let rankWord = false;

  const at = (i: number) => (used.has(i) ? undefined : items[i]);
  /** Nearest unused metric within `reach` items after (preferred) or before `i`. */
  const findMetric = (i: number, reach = 3, forwardOnly = false) => {
    for (let d = 1; d <= reach; d++) {
      const fwd = at(i + d);
      if (fwd?.t === "metric") return i + d;
      if (
        fwd &&
        !METRIC_UNITS.has(fwd.t) &&
        fwd.t !== "num" &&
        fwd.t !== "level"
      )
        break;
    }
    if (forwardOnly) return undefined;
    for (let d = 1; d <= reach; d++) {
      const back = at(i - d);
      if (back?.t === "metric") return i - d;
    }
    return undefined;
  };
  const metricOf = (idx: number | undefined) => {
    if (idx === undefined) return undefined;
    used.add(idx);
    return (items[idx] as Extract<Item, { t: "metric" }>).metric;
  };
  const setYears = (min?: number, max?: number) => {
    if (min !== undefined) filters.yearMin = String(min);
    if (max !== undefined) filters.yearMax = String(max);
  };

  // Filters, view, grouping, and "secondary <fuel>".
  const views: Extract<Item, { t: "view" }>[] = [];
  items.forEach((item, i) => {
    if (item.t === "filter") {
      const secondary =
        items[i - 1]?.t === "secondary" || items[i + 1]?.t === "secondary";
      const key =
        item.key === "primaryFuel" && secondary ? "secondaryFuel" : item.key;
      filters[key] = item.value;
      used.add(i);
    } else if (item.t === "view") {
      views.push(item);
      used.add(i);
    } else if (item.t === "group") {
      filters.rankGroup = "state";
      used.add(i);
    }
  });

  // Year phrases: "since 2020", "before 2018", "2015 to 2025", "from 2015 to 2025".
  items.forEach((item, i) => {
    if (item.t !== "yearword" || used.has(i)) return;
    const prev = at(i - 1);
    const next = at(i + 1);
    if (next?.t !== "num" || !next.yearLike) return;
    used.add(i).add(i + 1);
    if (item.op === "to" && prev?.t === "num" && prev.yearLike) {
      used.add(i - 1);
      setYears(prev.value, next.value);
    } else if (item.op === "since") setYears(next.value);
    else if (item.op === "after") setYears(next.value + 1);
    else if (item.op === "before") setYears(undefined, next.value - 1);
    else if (item.op === "until" || item.op === "to")
      setYears(undefined, next.value);
  });

  // Comparators: "CO2 over 500k", "more than 500,000 tons of CO2", "between 100k and 1M MWh".
  items.forEach((item, i) => {
    if (item.t !== "cmp" || used.has(i)) return;
    const first = at(i + 1)?.t === "num" ? i + 1 : undefined;
    if (first === undefined) return;
    let last = first;
    let second: number | undefined;
    if (item.op === "between") {
      const sep = at(first + 1);
      if (
        (sep?.t === "and" || (sep?.t === "yearword" && sep.op === "to")) &&
        at(first + 2)?.t === "num"
      ) {
        second = first + 2;
        last = second;
      }
    }
    const a = items[first] as Extract<Item, { t: "num" }>;
    const b =
      second === undefined
        ? undefined
        : (items[second] as Extract<Item, { t: "num" }>);
    const metricIdx = findMetric(last, 3, true) ?? findMetric(i, 3);
    let tonsOnly = false;
    if (metricIdx === undefined) {
      const tons = [1, 2].map((d) => last + d).find((j) => at(j)?.t === "tons");
      if (tons !== undefined) {
        used.add(tons);
        tonsOnly = true;
      }
    }
    if (
      metricIdx === undefined &&
      !tonsOnly &&
      a.yearLike &&
      (!b || b.yearLike)
    ) {
      // "between 2015 and 2025" / "after 2020" written with a comparator: a year range.
      used.add(i).add(first);
      if (second !== undefined) used.add(second);
      // Years are whole numbers, so a strict bound moves by one ("after 2020" = 2021 on).
      const step = item.strict ? 1 : 0;
      if (item.op === "between") setYears(a.value, b?.value);
      else if (item.op === "min") setYears(a.value + step);
      else setYears(undefined, a.value - step);
      return;
    }
    const metric =
      metricOf(metricIdx) ?? (tonsOnly ? "co2MassTons" : undefined);
    if (!metric) return;
    used.add(i).add(first);
    if (second !== undefined) used.add(second);
    for (let j = first + 1; j <= last + 2; j++)
      if (at(j)?.t === "tons") used.add(j);
    if (item.op === "between") {
      filters[`${metric}Min`] = String(Math.min(a.value, b?.value ?? a.value));
      filters[`${metric}Max`] = String(Math.max(a.value, b?.value ?? a.value));
    } else {
      const bound = item.op === "min" ? "Min" : "Max";
      filters[`${metric}${bound}`] = String(a.value);
      if (item.strict) filters[`${metric}${bound}Strict`] = "1";
    }
  });

  // Ranking: "top 10 units by CO2", "10 largest", "lowest SO2", "highest-generation".
  items.forEach((item, i) => {
    if (item.t !== "rank" || used.has(i)) return;
    used.add(i);
    rankWord = true;
    const after = at(i + 1);
    const before = at(i - 1);
    if (after?.t === "num" && !after.yearLike) {
      topN = after.value;
      used.add(i + 1);
    } else if (before?.t === "num" && !before.yearLike) {
      topN = before.value;
      used.add(i - 1);
    }
    const metric = metricOf(findMetric(i, 4));
    if (metric || !sort) sort = { by: metric ?? "co2MassTons", dir: item.dir };
  });

  // "high CO2", "low SO2 emissions": resolved to percentile thresholds on the server.
  items.forEach((item, i) => {
    if (item.t !== "level" || used.has(i)) return;
    const metric =
      metricOf(findMetric(i, 2)) ??
      (item.raw.toLowerCase().startsWith("dirt") ||
      item.raw.toLowerCase() === "clean"
        ? "co2MassTons"
        : undefined);
    if (!metric) return;
    used.add(i);
    qualitative.push({ metric, level: item.level });
  });

  // Plain years: one → that year, several → the range they span.
  const years = items
    .map((item, i) => ({ item, i }))
    .filter(({ item, i }) => item.t === "num" && item.yearLike && !used.has(i));
  if (years.length === 1) {
    filters.year = String(
      (years[0]!.item as Extract<Item, { t: "num" }>).value,
    );
    used.add(years[0]!.i);
  } else if (years.length > 1) {
    const values = years.map(
      ({ item }) => (item as Extract<Item, { t: "num" }>).value,
    );
    setYears(Math.min(...values), Math.max(...values));
    years.forEach(({ i }) => used.add(i));
  }

  // A bare metric with nothing attached ("coal units CO2") sorts by it, highest first.
  items.forEach((item, i) => {
    if (item.t === "metric" && !used.has(i)) {
      used.add(i);
      if (!sort && !qualitative.length) sort = { by: item.metric, dir: "desc" };
    }
  });

  if (rankWord) {
    // "the top facility in each state" = 1 per state; plural or unspecified = 10.
    topN ??=
      views.some((v) => v.singular) && !views.some((v) => !v.singular) ? 1 : 10;
    filters.topN = String(topN);
  }

  const connective = new Set<Item["t"]>([
    "yearword",
    "and",
    "secondary",
    "tons",
  ]);
  for (const [i, item] of items.entries()) {
    if (!used.has(i) && !connective.has(item.t)) unrecognized.push(item.raw);
  }

  let tab = views.some((v) => v.tab === "units")
    ? ("units" as const)
    : views.length
      ? ("explorer" as const)
      : undefined;
  // The Facilities table only sorts by CO₂; other metrics and unit-year thresholds need the Units view.
  const sortMetric = sort?.by ?? qualitative[0]?.metric;
  if (tab === "explorer" && sortMetric && sortMetric !== "co2MassTons")
    tab = "units";

  return { filters, tab, sort, qualitative, unrecognized };
}
