'use client'

import { useTranslation } from 'react-i18next'
import {
  formatDuration,
  formatDurationShort,
  roundAxisMax,
  waitAxisMax,
} from '@/lib/insights-format'
import { CHART, type ChartColor } from './chart-colors'
import { Legend, Muted } from './ui-bits'

export type ChartStack<P> = {
  label: string
  color: ChartColor
  value: (point: P) => number
}

type Props<P> = {
  points: P[]
  stacks: ChartStack<P>[]
  wait: (point: P) => number | null
  /** Rótulo do eixo X. */
  short: (point: P) => string
  /** Rótulo completo, no tooltip. */
  full: (point: P) => string
  refSec: number
  leftTitle: string
}

const L = 50
const R = 58
const T = 16
const IH = 230

/**
 * Barras empilhadas (quantidade, eixo da esquerda) cruzadas com a espera
 * típica pela 1ª resposta (linha, eixo da direita), como o `mixedChart` do
 * original. SVG puro: o front não tem biblioteca de gráfico, e este é o único
 * formato que a tela precisa. Os textos entram como nós de texto do React.
 */
export function MixedChart<P>({
  points,
  stacks,
  wait,
  short,
  full,
  refSec,
  leftTitle,
}: Props<P>) {
  const { t, i18n } = useTranslation('thinkzap/insights')
  const locale = i18n.language

  if (!points.length) return <Muted>{t('empty.noConversations')}</Muted>

  const n = points.length
  const rotate = n > 14
  const B = rotate ? 58 : 30
  const slot = Math.max(26, 760 / n)
  const W = L + R + slot * n
  const H = T + IH + B
  const totals = points.map(p => stacks.reduce((a, s) => a + s.value(p), 0))
  const maxV = roundAxisMax(Math.max(1, ...totals))
  const waits = points.map(wait)
  const maxW = waitAxisMax(waits, refSec)
  const cap = refSec * 6
  const ticks = maxV % 4 === 0 ? 4 : 5
  const yL = (v: number) => T + IH - (v / maxV) * IH
  const yR = (v: number) => T + IH - (Math.min(v, maxW) / maxW) * IH
  const cx = (i: number) => L + i * slot + slot / 2
  const bw = Math.min(slot * 0.62, 34)

  // Linha só entre pontos com dado: período sem resposta não é espera zero.
  let path = ''
  let pen = false
  waits.forEach((w, i) => {
    if (w == null) {
      pen = false
      return
    }
    path += `${pen ? 'L' : 'M'}${cx(i)},${yR(w)} `
    pen = true
  })

  return (
    <div>
      <Legend
        items={[
          ...stacks.map(s => ({ label: s.label, swatch: s.color.bg })),
          { label: t('chart.waitLine'), swatch: CHART.wait.bg, line: true },
          {
            label: t('chart.reference', { value: formatDuration(refSec) }),
            swatch: CHART.reference.bg,
            line: true,
          },
        ]}
      />
      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full text-[10.5px]"
          style={{ minWidth: n > 30 ? Math.min(W, 1100) : 0 }}
          role="img"
          aria-label={leftTitle}
        >
          {Array.from({ length: ticks + 1 }, (_, k) => {
            const v = (maxV / ticks) * k
            return (
              <g key={`l${k}`}>
                <line
                  x1={L}
                  x2={W - R}
                  y1={yL(v)}
                  y2={yL(v)}
                  className="stroke-border"
                />
                <text
                  x={L - 8}
                  y={yL(v) + 4}
                  textAnchor="end"
                  className="fill-muted-foreground"
                >
                  {Math.round(v)}
                </text>
              </g>
            )
          })}
          {Array.from({ length: 5 }, (_, k) => (
            <text
              key={`r${k}`}
              x={W - R + 8}
              y={yR((maxW / 4) * k) + 4}
              className="fill-muted-foreground"
            >
              {formatDurationShort((maxW / 4) * k, locale)}
            </text>
          ))}
          <text
            transform={`translate(14,${T + IH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-muted-foreground font-semibold"
          >
            {leftTitle}
          </text>
          <text
            transform={`translate(${W - 10},${T + IH / 2}) rotate(90)`}
            textAnchor="middle"
            className="fill-muted-foreground font-semibold"
          >
            {t('chart.rightAxis')}
          </text>

          {points.map((p, i) => {
            let acc = 0
            const x = cx(i) - bw / 2
            const ly = T + IH + 14
            return (
              <g key={i}>
                {stacks.map(s => {
                  const v = s.value(p)
                  if (!v) return null
                  const y0 = yL(acc)
                  acc += v
                  return (
                    <rect
                      key={s.label}
                      x={x}
                      y={yL(acc)}
                      width={bw}
                      height={y0 - yL(acc)}
                      className={s.color.fill}
                    >
                      <title>{`${full(p)} · ${s.label}: ${v}`}</title>
                    </rect>
                  )
                })}
                {rotate ? (
                  <text
                    transform={`translate(${cx(i) + 3},${ly}) rotate(-45)`}
                    textAnchor="end"
                    className="fill-muted-foreground"
                  >
                    {short(p)}
                  </text>
                ) : (
                  <text
                    x={cx(i)}
                    y={ly + 2}
                    textAnchor="middle"
                    className="fill-muted-foreground"
                  >
                    {short(p)}
                  </text>
                )}
              </g>
            )
          })}

          <line
            x1={L}
            x2={W - R}
            y1={T + IH}
            y2={T + IH}
            className="stroke-slate-300"
          />
          <line
            x1={L}
            x2={W - R}
            y1={yR(refSec)}
            y2={yR(refSec)}
            className={CHART.reference.stroke}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <path
            d={path}
            fill="none"
            className={CHART.wait.stroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => {
            const w = waits[i]
            if (w == null) return null
            const over = w > refSec
            return (
              <g key={`w${i}`}>
                <circle
                  cx={cx(i)}
                  cy={yR(w)}
                  r={4}
                  strokeWidth={2}
                  className={
                    over
                      ? 'fill-background stroke-red-500'
                      : 'fill-background stroke-slate-700'
                  }
                >
                  <title>
                    {t('chart.waitTooltip', {
                      label: full(p),
                      value: formatDuration(w),
                    })}
                  </title>
                </circle>
                <text
                  x={cx(i)}
                  y={yR(w) - 9}
                  textAnchor="middle"
                  className={
                    over ? 'fill-red-600 font-bold' : 'fill-slate-700 font-bold'
                  }
                >
                  {`${w > cap ? '+' : ''}${formatDurationShort(w, locale)}`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('chart.note', {
          ref: formatDuration(refSec),
          cap: formatDuration(cap),
        })}
      </p>
    </div>
  )
}
