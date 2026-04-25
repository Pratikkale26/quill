// Minimal terminal styling for the CLI. ANSI directly — keeps deps small.

const ESC = "[";

const wrap = (open: string) => (s: string) => `${ESC}${open}${s}${ESC}0m`;

export const dim = wrap("2m");
export const bold = wrap("1m");
export const green = wrap("32m");
export const yellow = wrap("33m");
export const red = wrap("31m");
export const cyan = wrap("36m");

export const symbols = {
  ok: green("✓"),
  err: red("✗"),
  pending: dim("·"),
  arrow: cyan("→"),
};
