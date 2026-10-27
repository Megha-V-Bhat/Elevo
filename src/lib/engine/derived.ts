/** A value that is only present when every input needed to compute it exists. */
export type Derived<T> = { value: T; reason: null } | { value: null; reason: string };

export const ok = <T>(value: T): Derived<T> => ({ value, reason: null });
export const missing = <T = never>(reason: string): Derived<T> => ({ value: null, reason });

export const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
