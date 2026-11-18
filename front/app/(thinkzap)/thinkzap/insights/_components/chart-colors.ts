/**
 * Cores dos gráficos como classes do Tailwind: `fill` para o SVG e `bg` para a
 * legenda e as barras em CSS. Mantidas juntas para a legenda nunca divergir da
 * barra.
 */
export const CHART = {
  answered: { fill: 'fill-emerald-500', bg: 'bg-emerald-500' },
  noAnswer: { fill: 'fill-red-500', bg: 'bg-red-500' },
  open: { fill: 'fill-slate-300', bg: 'bg-slate-300' },
  volume: { fill: 'fill-primary/70', bg: 'bg-primary/70' },
  volumePeak: { fill: 'fill-primary', bg: 'bg-primary' },
  wait: { stroke: 'stroke-slate-700', bg: 'bg-slate-700' },
  reference: { stroke: 'stroke-amber-500', bg: 'bg-amber-500' },
} as const

export type ChartColor = { fill: string; bg: string }
