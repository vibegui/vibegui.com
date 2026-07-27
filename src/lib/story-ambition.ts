import type { Locale } from "./manifest";

export const AMBITION_MIN = 30;
export const AMBITION_MAX = 100;
export const AMBITION_STEP = 5;
export const AMBITION_DEFAULT = 100;
export const AMBITION_MULTIPLE = 5.5;
export const AMBITION_FX_BRL = 5;

const GROWTH_BASE = [8, 24, 72, 144, 288, 500] as const;
const GROWTH_RATIOS = GROWTH_BASE.map((n) => n / 500);

export type AmbitionState = {
  v: number;
  locale: Locale;
  numberLocale: string;
  exitLocal: number;
  arrLocal: number;
  mrrLocal: number;
  smbContract: number;
  entContract: number;
  smbCustomers: number;
  entCustomers: number;
  stages: number[];
  month18Customers: number;
  month24Customers: number;
  finalGrowthPct: number;
  finalMultiple: number;
  tokens: Record<string, string>;
};

function clampAmbition(value: number): number {
  const stepped =
    Math.round((value - AMBITION_MIN) / AMBITION_STEP) * AMBITION_STEP +
    AMBITION_MIN;
  return Math.min(AMBITION_MAX, Math.max(AMBITION_MIN, stepped));
}

export function parseAmbitionHash(hash: string): number {
  const match = /(?:^|[&#?])v=(\d+)/i.exec(hash);
  if (!match) return AMBITION_DEFAULT;
  return clampAmbition(Number(match[1]));
}

export function writeAmbitionHash(v: number): void {
  const next = clampAmbition(v);
  const url = new URL(window.location.href);
  url.hash = `v=${next}`;
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function formatMillionsCompact(
  millions: number,
  locale: Locale,
  numberLocale: string,
): string {
  if (millions > 0 && millions < 1) {
    const thousands = Math.round(millions * 1000);
    const body = thousands.toLocaleString(numberLocale);
    return locale === "en" ? `$${body}K` : `R$${body}K`;
  }

  const rounded =
    Math.abs(millions - Math.round(millions)) < 0.05
      ? Math.round(millions)
      : Math.round(millions * 10) / 10;
  const body = rounded.toLocaleString(numberLocale, {
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  });
  return locale === "en" ? `$${body}M` : `R$${body}M`;
}

function formatMillionsLong(
  millions: number,
  locale: Locale,
  numberLocale: string,
): string {
  if (millions > 0 && millions < 1) {
    const thousands = Math.round(millions * 1000);
    const body = thousands.toLocaleString(numberLocale);
    return locale === "en" ? `$${body} thousand` : `R$${body} mil`;
  }

  const rounded =
    Math.abs(millions - Math.round(millions)) < 0.05
      ? Math.round(millions)
      : Math.round(millions * 10) / 10;
  const body = rounded.toLocaleString(numberLocale, {
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  });
  if (locale === "en") {
    return `$${body} million`;
  }
  return `R$${body} milhões`;
}

function formatMultiple(value: number, locale: Locale): string {
  const text = value.toLocaleString(locale === "en" ? "en-US" : "pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
  return locale === "en" ? `${text}×` : `${text}x`;
}

export type GrowthTarget = {
  stages: number[];
  month18Customers: number;
  month24Customers: number;
  finalGrowthPct: number;
  finalMultiple: number;
  growthStart: number;
};

export function computeGrowthTarget(targetCustomers: number): GrowthTarget {
  const target = Math.max(1, Math.round(targetCustomers));
  const stages = GROWTH_RATIOS.map((ratio, index) => {
    if (index === GROWTH_RATIOS.length - 1) return target;
    return Math.max(1, Math.round(target * ratio));
  });
  const month18Customers = stages[4] ?? target;
  const month24Customers = stages[5] ?? target;
  return {
    stages,
    month18Customers,
    month24Customers,
    finalGrowthPct: Math.round(
      ((month24Customers - month18Customers) / month18Customers) * 100,
    ),
    finalMultiple: month24Customers / month18Customers,
    growthStart: stages[0] ?? target,
  };
}

export function applyGrowthTarget(
  root: HTMLElement,
  targetCustomers: number,
  locale: Locale,
): void {
  const numberLocale = locale === "en" ? "en-US" : "pt-BR";
  const growth = computeGrowthTarget(targetCustomers);
  const finalMultiple = formatMultiple(growth.finalMultiple, locale);
  const growthStartLabel = growth.growthStart.toLocaleString(numberLocale);
  const growthStartNoun =
    locale === "en"
      ? growth.growthStart === 1
        ? "customer"
        : "customers"
      : growth.growthStart === 1
        ? "cliente"
        : "clientes";

  for (const el of root.querySelectorAll<HTMLElement>("[data-ambition]")) {
    const token = el.dataset.ambition;
    if (!token) continue;

    if (token === "growthCustomers") {
      const stage = Number(el.dataset.stage ?? "0");
      const customers = growth.stages[stage] ?? growth.month24Customers;
      el.textContent = customers.toLocaleString(numberLocale);
      continue;
    }

    if (token === "growthBar") {
      const stage = Number(el.dataset.stage ?? "0");
      const customers = growth.stages[stage] ?? growth.month24Customers;
      el.style.setProperty(
        "--bar",
        `${(customers / growth.month24Customers) * 100}%`,
      );
      continue;
    }

    if (token === "growthMultiple") {
      const stage = Number(el.dataset.stage ?? "0");
      if (stage === growth.stages.length - 1) {
        el.textContent = finalMultiple;
      }
      continue;
    }

    if (token === "month18Customers") {
      el.textContent = growth.month18Customers.toLocaleString(numberLocale);
      continue;
    }

    if (token === "month24Customers") {
      el.textContent = growth.month24Customers.toLocaleString(numberLocale);
      continue;
    }

    if (token === "finalGrowthPct") {
      el.textContent = `${growth.finalGrowthPct}%`;
      continue;
    }

    if (token === "finalMultiple") {
      el.textContent = finalMultiple;
      continue;
    }

    if (token === "growthStart") {
      el.textContent = growthStartLabel;
      continue;
    }

    if (token === "growthStartWith") {
      el.textContent = `${growthStartLabel} ${growthStartNoun}`;
    }
  }
}

export function computeAmbition(
  vMillionsUsd: number,
  locale: Locale,
): AmbitionState {
  const v = clampAmbition(vMillionsUsd);
  const numberLocale = locale === "en" ? "en-US" : "pt-BR";
  const fx = locale === "en" ? 1 : AMBITION_FX_BRL;
  const exitMillions = v * fx;
  // Match the essay's clean ladder: floor exit/5.5 so $100M → $18M ARR → $1.5M MRR → 500 customers.
  const arrMillions = Math.floor(exitMillions / AMBITION_MULTIPLE + 1e-9);
  const mrrMillions = arrMillions / 12;
  const exitLocal = exitMillions * 1_000_000;
  const arrLocal = arrMillions * 1_000_000;
  const mrrLocal = mrrMillions * 1_000_000;
  const smbContract = locale === "en" ? 3_000 : 15_000;
  const entContract = locale === "en" ? 30_000 : 150_000;
  const smbCustomers = Math.ceil(mrrLocal / smbContract);
  const entCustomers = Math.ceil(mrrLocal / entContract);
  const growth = computeGrowthTarget(smbCustomers);

  const exitCompact = formatMillionsCompact(exitMillions, locale, numberLocale);
  const arrCompact = formatMillionsCompact(arrMillions, locale, numberLocale);
  const mrrCompact = formatMillionsCompact(mrrMillions, locale, numberLocale);
  const exitLong = formatMillionsLong(exitMillions, locale, numberLocale);
  const arrLong = formatMillionsLong(arrMillions, locale, numberLocale);
  const mrrLong = formatMillionsLong(mrrMillions, locale, numberLocale);
  const growthStartLabel = growth.growthStart.toLocaleString(numberLocale);
  const growthStartNoun =
    locale === "en"
      ? growth.growthStart === 1
        ? "customer"
        : "customers"
      : growth.growthStart === 1
        ? "cliente"
        : "clientes";
  const growthStartEnough =
    locale === "en"
      ? `${growthStartLabel} is enough for the math`
      : growth.growthStart === 1
        ? `${growthStartLabel} basta para a matemática`
        : `${growthStartLabel} bastam para a matemática`;

  const tokens: Record<string, string> = {
    exitCompact,
    arrCompact,
    mrrCompact,
    exitLong,
    arrLong,
    mrrLong,
    arrCompactLabel: `${arrCompact} ARR`,
    mrrCompactLabel: `${mrrCompact} MRR`,
    smbCustomers: smbCustomers.toLocaleString(numberLocale),
    entCustomers: entCustomers.toLocaleString(numberLocale),
    month18Customers: growth.month18Customers.toLocaleString(numberLocale),
    month24Customers: growth.month24Customers.toLocaleString(numberLocale),
    finalGrowthPct: `${growth.finalGrowthPct}%`,
    finalMultiple: formatMultiple(growth.finalMultiple, locale),
    growthStart: growthStartLabel,
    growthStartWith: `${growthStartLabel} ${growthStartNoun}`,
    growthStartEnough,
    calculatorMrr: mrrCompact,
  };

  return {
    v,
    locale,
    numberLocale,
    exitLocal,
    arrLocal,
    mrrLocal,
    smbContract,
    entContract,
    smbCustomers,
    entCustomers,
    stages: growth.stages,
    month18Customers: growth.month18Customers,
    month24Customers: growth.month24Customers,
    finalGrowthPct: growth.finalGrowthPct,
    finalMultiple: growth.finalMultiple,
    tokens,
  };
}

export function applyAmbition(root: HTMLElement, state: AmbitionState): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-ambition]")) {
    const token = el.dataset.ambition;
    if (!token) continue;

    if (token === "growthCustomers") {
      const stage = Number(el.dataset.stage ?? "0");
      const customers = state.stages[stage] ?? state.smbCustomers;
      el.textContent = customers.toLocaleString(state.numberLocale);
      continue;
    }

    if (token === "growthBar") {
      const stage = Number(el.dataset.stage ?? "0");
      const customers = state.stages[stage] ?? state.smbCustomers;
      el.style.setProperty(
        "--bar",
        `${(customers / state.smbCustomers) * 100}%`,
      );
      continue;
    }

    if (token === "growthMultiple") {
      const stage = Number(el.dataset.stage ?? "0");
      if (stage === state.stages.length - 1) {
        el.textContent = state.tokens.finalMultiple ?? "";
      }
      continue;
    }

    const value = state.tokens[token];
    if (value != null) el.textContent = value;
  }

  const thesis = root.querySelector<HTMLElement>(".story-thesis");
  if (thesis) {
    thesis.setAttribute(
      "aria-label",
      state.locale === "en"
        ? `Twenty-four months of execution can produce ${state.tokens.arrLong} in annual recurring revenue and a ${state.tokens.exitLong} company at a five-point-five-times revenue multiple.`
        : `Vinte e quatro meses de execução podem produzir ${state.tokens.arrLong} em receita recorrente anual e uma empresa de ${state.tokens.exitLong} com um múltiplo de cinco vírgula cinco vezes a receita.`,
    );
  }

  const slider = root.querySelector<HTMLInputElement>("[data-ambition-slider]");
  if (slider && Number(slider.value) !== state.v) {
    slider.value = String(state.v);
  }
}
