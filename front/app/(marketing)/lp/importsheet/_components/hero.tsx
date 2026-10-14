import Image from 'next/image'
import { ArrowDown, ArrowRight, CircleCheck } from 'lucide-react'
import { CtaButtons } from '../../_shared/cta-buttons'
import { LpHeader as LpHeaderBase } from '../../_shared/lp-header'
import type { LpCtas } from '../../_shared/resolve-ctas'
import { LP_BASE_PATH, LP_LOCALES, type LpContent } from './content'

export function LpHeader({
  marketUrl,
  content,
}: Pick<LpCtas, 'marketUrl'> & { content: LpContent }) {
  return (
    <LpHeaderBase
      logo={
        <Image
          src="/images/importsheet/logo.png"
          alt="ImportSheet"
          width={130}
          height={60}
          priority
          className="h-9 w-auto"
        />
      }
      basePath={LP_BASE_PATH}
      locales={LP_LOCALES}
      marketUrl={marketUrl}
      content={content}
    />
  )
}

export function Hero({ content, ...ctas }: LpCtas & { content: LpContent }) {
  const hero = content.hero
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-primary/15 via-primary/5 to-transparent">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {hero.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {hero.title}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            {hero.subtitle}
          </p>
          <CtaButtons {...ctas} labels={content.ctaButtons} className="mt-8" />
        </div>
        <SheetPreview copy={content.sheetPreview} />
      </div>
    </section>
  )
}

function SheetPreview({ copy }: { copy: LpContent['sheetPreview'] }) {
  const letters = ['A', 'B', 'C']
  // A primeira linha já existia (atualizada pelo identificador); as outras são novas.
  const outcome = (index: number) => (index === 0 ? copy.updated : copy.created)

  return (
    <div
      aria-hidden
      className="mx-auto flex w-full max-w-md flex-col items-center gap-3 lg:max-w-lg lg:flex-row"
    >
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card text-xs shadow-xl">
        <div className="grid grid-cols-[1.5rem_3rem_1fr_4.5rem] border-b border-border bg-muted text-center font-medium text-muted-foreground">
          <span className="border-r border-border py-1" />
          {letters.map(letter => (
            <span
              key={letter}
              className="border-r border-border py-1 last:border-r-0"
            >
              {letter}
            </span>
          ))}
        </div>
        {[copy.columns, ...copy.rows].map((row, index) => (
          <div
            key={index}
            className={`grid grid-cols-[1.5rem_3rem_1fr_4.5rem] border-b border-border last:border-b-0 ${index === 0 ? 'font-semibold' : ''}`}
          >
            <span className="border-r border-border bg-muted py-1.5 text-center text-muted-foreground">
              {index + 1}
            </span>
            {row.map((cell, cellIndex) => (
              <span
                key={cellIndex}
                className="truncate border-r border-border px-2 py-1.5 last:border-r-0"
              >
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>

      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
        <ArrowDown className="size-4 lg:hidden" />
        <ArrowRight className="hidden size-4 lg:block" />
      </span>

      <div className="w-full rounded-xl border border-border bg-card p-3 shadow-xl">
        <p className="mb-2 text-xs font-semibold text-foreground">
          Bitrix24 · {copy.entity}
        </p>
        <ul className="space-y-1.5">
          {copy.rows.map((row, index) => (
            <li
              key={row[0]}
              className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
            >
              <CircleCheck className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                #{row[0]} · {row[1]}
              </span>
              <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {outcome(index)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
