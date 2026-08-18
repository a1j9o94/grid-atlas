import { req } from "../lib/assert";
import { NO_DATA } from "./constants";

export interface Scale {
  ramp: readonly string[];
  breaks: number[];
  min?: number;
  max?: number;
  of(v: unknown): string;
}

// Bucket a value onto a ramp. Quantiles rather than equal intervals, because
// these distributions have long tails: Hawaii at 42.86 cents would otherwise
// flatten the other fifty states into the first two steps.
//
// A measure can override with `fixed` breaks, and one has to. Smart meter
// rollout is close to binary per utility, so its quantiles come out as
// [0, 59.13, 100, 100]: two identical breaks drawing a five-step legend over a
// three-colour map. Quantiles need a spread distribution to describe.
export function makeScale(
  values: readonly unknown[],
  ramp: readonly string[],
  fixed?: readonly number[],
): Scale {
  const sorted = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!sorted.length) return { of: () => NO_DATA, breaks: [], ramp };
  const breaks = fixed ? [...fixed.slice(0, ramp.length - 1)] : [];
  if (!fixed)
    for (let i = 1; i < ramp.length; i++)
      breaks.push(req(sorted[Math.floor((sorted.length * i) / ramp.length)], "quantile break"));
  return {
    ramp,
    breaks,
    min: req(sorted[0]),
    max: req(sorted[sorted.length - 1]),
    of(v) {
      if (typeof v !== "number" || !Number.isFinite(v)) return NO_DATA;
      let i = 0;
      while (i < breaks.length && v >= req(breaks[i])) i++;
      return req(ramp[i], "ramp step");
    },
  };
}
