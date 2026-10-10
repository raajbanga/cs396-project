import { z } from "zod";

import { env } from "~/env";
import type { ParsedDescription, SearchVocab } from "~/lib/describe-search";
import { UNIT_METRICS, type FacilityFilters } from "~/lib/facility-filters";

/**
 * Optional fallback for description search (rubric §6): when the rule-based parser leaves words it
 * couldn't interpret, an OpenRouter model may map them onto the same filters. The model only adds
 * filters the parser didn't set, every value is checked against the database vocabulary, and any
 * failure (no key, timeout, bad JSON) falls back to the parser's result. The key stays on the server.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** OpenRouter's router across free models that support structured outputs. */
const DEFAULT_MODEL = "openrouter/free";
const TIMEOUT_MS = 8000;

type Additions = Partial<FacilityFilters>;
export type LlmResult =
  | { ok: true; filters: Additions; unrecognized: string[] }
  | { ok: false; note: string };

const cache = new Map<string, LlmResult>();

const nullable = (schema: Record<string, unknown>) => ({
  anyOf: [schema, { type: "null" }],
});

/** JSON schema the model must fill: allowed values only, null when a word doesn't map. */
function responseSchema(vocab: SearchVocab) {
  const enumOf = (values: string[]) =>
    nullable({ type: "string", enum: values.filter((v) => v !== "Other") });
  const number = nullable({ type: "number" });
  const properties: Record<string, unknown> = {
    stateCode: enumOf(vocab.states),
    primaryFuel: enumOf(vocab.fuels),
    secondaryFuel: enumOf(vocab.secondaryFuels),
    unitType: enumOf(vocab.unitTypes),
    so2Control: enumOf(vocab.so2Controls),
    noxControl: enumOf(vocab.noxControls),
    pmControl: enumOf(vocab.pmControls),
    operatingStatus: enumOf(vocab.operatingStatuses),
    year: number,
    yearMin: number,
    yearMax: number,
    ...Object.fromEntries(
      UNIT_METRICS.flatMap(({ key }) => [
        [`${key}Min`, number],
        [`${key}Max`, number],
      ]),
    ),
    stillNotUnderstood: { type: "array", items: { type: "string" } },
  };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const SYSTEM_PROMPT = `You help search a database of U.S. power-plant units and their annual emissions.
A rule-based parser already interpreted part of the user's request. You receive the request, what was
already understood, and the leftover words it could not interpret. Map ONLY the leftover words onto the
allowed filter fields; leave every other field null. Use only values from the allowed enums. Numeric
fields are inclusive bounds (tons for CO2/SO2/NOx, MWh for generation, MMBtu for heat input, hours for
operating time). The filters cannot express NOT: map a negation only when it equals a positive allowed
value (e.g. "not retired" -> operatingStatus "Operating"); otherwise leave it null. List leftover words
you could not map in stillNotUnderstood. Never guess.`;

/** Asks OpenRouter to map `parsed.unrecognized`; only filters the parser didn't set are kept. */
export async function llmFallback(
  text: string,
  parsed: ParsedDescription,
  vocab: SearchVocab,
): Promise<LlmResult> {
  if (!env.OPENROUTER_API_KEY) {
    return { ok: false, note: "LLM fallback off (no OPENROUTER_API_KEY)" };
  }
  const cached = cache.get(text);
  if (cached) return cached;

  let result: LlmResult;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "epaData",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              request: text,
              alreadyUnderstood: parsed.filters,
              leftoverWords: parsed.unrecognized,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "search_filters",
            strict: true,
            schema: responseSchema(vocab),
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    const json: unknown = JSON.parse(/\{[\s\S]*\}/.exec(content)?.[0] ?? "");
    result = toAdditions(json, parsed, vocab);
  } catch (err) {
    result = {
      ok: false,
      note: `LLM fallback unavailable (${err instanceof Error ? err.message : String(err)})`,
    };
  }
  if (cache.size > 200) cache.clear();
  cache.set(text, result);
  return result;
}

/** Validates the model's answer against the vocabulary and drops anything the parser already set. */
function toAdditions(
  json: unknown,
  parsed: ParsedDescription,
  vocab: SearchVocab,
): LlmResult {
  const raw = z.record(z.unknown()).safeParse(json);
  if (!raw.success) return { ok: false, note: "LLM fallback returned no JSON" };
  const allowed: Partial<Record<keyof FacilityFilters, string[]>> = {
    stateCode: vocab.states,
    primaryFuel: vocab.fuels,
    secondaryFuel: vocab.secondaryFuels,
    unitType: vocab.unitTypes,
    so2Control: vocab.so2Controls,
    noxControl: vocab.noxControls,
    pmControl: vocab.pmControls,
    operatingStatus: vocab.operatingStatuses,
  };
  const numeric = [
    "year",
    "yearMin",
    "yearMax",
    ...UNIT_METRICS.flatMap(({ key }) => [`${key}Min`, `${key}Max`]),
  ];
  const filters: Additions = {};
  for (const [key, value] of Object.entries(raw.data)) {
    const k = key as keyof FacilityFilters;
    if (value === null || value === undefined || parsed.filters[k]) continue;
    const values = allowed[k];
    if (values && typeof value === "string" && values.includes(value)) {
      filters[k] = value;
    } else if (
      numeric.includes(key) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      filters[k] = String(value);
    }
  }
  const still = z.array(z.string()).safeParse(raw.data.stillNotUnderstood);
  const leftover = new Set(parsed.unrecognized);
  return {
    ok: true,
    filters,
    // Words the model claims are unmapped, limited to what was actually left over.
    unrecognized: Object.keys(filters).length
      ? (still.success ? still.data : []).filter((w) => leftover.has(w))
      : parsed.unrecognized,
  };
}
