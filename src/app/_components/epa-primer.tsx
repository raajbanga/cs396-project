const TERMS = [
  {
    term: "ORISPL ID",
    body: "The permanent federal facility ID issued by DOE/EIA. Every power plant in the data has one, and it is the facility key used throughout epaData.",
  },
  {
    term: "NERC region",
    body: "The reliability council whose grid a plant feeds, such as ERCOT, WECC, or SERC.",
  },
  {
    term: "Nameplate capacity (MW)",
    body: "Maximum sustained electrical output. One megawatt reliably powers roughly 750 to 1,000 homes.",
  },
  {
    term: "CO₂ rate (lbs/MWh)",
    body: "Pounds of CO₂ emitted per megawatt-hour generated. Gas combined cycle is about 800, coal about 2,100; nuclear and renewables are 0.",
  },
  {
    term: "Data-quality checks",
    body: "Every stored unit-year is checked against physical-sanity rules: heat rate outside 5–25 MMBtu/MWh, generation with zero operating hours, and heat input with no CO₂ reported.",
  },
];

/** Glossary of the terms the tables use, collapsed by default. */
export function EpaPrimer() {
  return (
    <details className="group">
      <summary className="text-fg cursor-pointer text-base font-semibold">
        Terms used in the data
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-x-10 gap-y-4 text-sm sm:grid-cols-2">
        {TERMS.map(({ term, body }) => (
          <div key={term}>
            <dt className="text-fg font-medium">{term}</dt>
            <dd className="text-fg-2 mt-0.5 max-w-[60ch]">{body}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
