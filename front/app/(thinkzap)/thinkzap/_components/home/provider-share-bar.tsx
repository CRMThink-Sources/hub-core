const numberFormatter = new Intl.NumberFormat('pt-BR')

type Props = {
  zapiTotal: number
  hubmessageTotal: number
}

/**
 * Proporção Web vs Business do total de mensagens do período — uma barra só,
 * dividida, em vez de gráfico com eixo. Só faz sentido com os dois providers
 * presentes; com um só, "100% de um lado" não é comparação nenhuma.
 *
 * Cor não carrega a identidade sozinha: cada segmento tem legenda com nome e
 * valor ao lado do swatch, não só a cor. `bg-primary` (marca da instalação,
 * varia por tema) para Business e um neutro dessaturado para Web — a leitura
 * não depende de distinguir matizes.
 */
export function ProviderShareBar({ zapiTotal, hubmessageTotal }: Props) {
  const total = zapiTotal + hubmessageTotal
  if (total === 0) return null

  const zapiPercent = (zapiTotal / total) * 100
  const hubmessagePercent = 100 - zapiPercent

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Web vs Business no período
      </h3>

      <div className="mt-3 flex h-6 w-full overflow-hidden rounded-full bg-muted">
        {zapiTotal > 0 && (
          <div
            className="h-full bg-slate-400 dark:bg-slate-500"
            style={{ width: `${zapiPercent}%` }}
          />
        )}
        {zapiTotal > 0 && hubmessageTotal > 0 && (
          <div className="h-full w-[2px] bg-card" />
        )}
        {hubmessageTotal > 0 && (
          <div
            className="h-full bg-primary"
            style={{ width: `${hubmessagePercent}%` }}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        <LegendItem
          swatchClassName="bg-slate-400 dark:bg-slate-500"
          label="Web"
          value={zapiTotal}
          percent={zapiPercent}
        />
        <LegendItem
          swatchClassName="bg-primary"
          label="Business"
          value={hubmessageTotal}
          percent={hubmessagePercent}
        />
      </div>
    </div>
  )
}

function LegendItem({
  swatchClassName,
  label,
  value,
  percent,
}: {
  swatchClassName: string
  label: string
  value: number
  percent: number
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`size-2.5 shrink-0 rounded-full ${swatchClassName}`} />
      <span className="text-foreground">{label}</span>
      <span className="text-muted-foreground">
        {numberFormatter.format(value)} ({Math.round(percent)}%)
      </span>
    </div>
  )
}
