export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const round = (n: number, digits = 2) => Number(n.toFixed(digits));
export const mean = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
export const stddev = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)));
};
export const floorToPrecision = (n: number, precision: number) => {
  const p = 10 ** precision;
  return Math.floor(n * p) / p;
};
