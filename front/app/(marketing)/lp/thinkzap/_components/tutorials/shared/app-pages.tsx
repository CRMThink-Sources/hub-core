import { InfoIcon, MoreHorizontal } from 'lucide-react'
import type { LineProvider, LineTabId } from '../../content'
import { useLpContent } from '../../content/locale-context'
import { HOTSPOT_RING, PingDot, type ScreenProps } from './frame'

/**
 * Cascas das telas do app usadas por mais de um tutorial. Espelham:
 * - conexões: `_layout/conexoes-layout.tsx`, `conexoes-tabela-conectores.tsx`,
 *   `conexao-row.tsx`
 * - linha: `conexoes/[subscriptionItemId]/configuracoes/page.tsx`, `config-card.tsx`
 */

export type { LineProvider, LineTabId }

/** Casca da tela de conexões (`conexoes-layout`) com o cabeçalho real. */
export function ConexoesPage({ children }: { children: React.ReactNode }) {
  const { shared } = useLpContent()

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-lg font-bold tracking-tight text-foreground">
          {shared.conexoesTitle}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {shared.conexoesSubtitle}
        </p>
      </div>
      {children}
    </div>
  )
}

export function ProviderBadge({
  provider = 'web',
}: {
  provider?: LineProvider
}) {
  const { providerLabel } = useLpContent().shared

  return (
    <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {providerLabel[provider]}
    </span>
  )
}

export function ActiveLinesBadge({ count }: { count: string }) {
  const { shared } = useLpContent()

  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
      <InfoIcon aria-hidden className="size-4" />
      {shared.activeLines(count)}
    </div>
  )
}

export type LineRowData = {
  name: string
  provider: LineProvider
  subtitle: string
  status: string
}

/**
 * Tabela de conexões. `hotspot` transforma a linha de índice `hotspot.index` no
 * elemento destacado — a linha inteira é o botão, como no `conexao-row`.
 */
export function LinesTable({
  rows,
  hotspot,
}: {
  rows: LineRowData[]
  hotspot?: ScreenProps & { index: number }
}) {
  const { shared } = useLpContent()

  return (
    <div className="w-full rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 rounded-t-xl border-b border-border bg-muted px-4 py-2.5">
        <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {shared.tableName}
        </span>
        <span className="flex flex-1 justify-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {shared.tableStatus}
        </span>
        <span className="w-10" />
      </div>
      {rows.map((row, index) => {
        const content = (
          <span className="flex items-center justify-between gap-4">
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate text-base font-semibold text-foreground">
                  {row.name}
                </span>
                <ProviderBadge provider={row.provider} />
              </span>
              <span className="mt-1 block truncate text-sm text-muted-foreground">
                {row.subtitle}
              </span>
            </span>
            <span className="flex flex-1 justify-center">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {row.status}
              </span>
            </span>
            <span className="inline-flex size-8 w-10 items-center justify-center rounded-md border border-border bg-background">
              <MoreHorizontal aria-hidden className="size-4" />
            </span>
          </span>
        )
        const last = index === rows.length - 1
        const shape = `block w-full p-4 text-left ${last ? 'rounded-b-xl' : 'border-b border-border'}`

        if (hotspot?.index === index) {
          return (
            <button
              key={row.name}
              type="button"
              data-hotspot
              aria-label={hotspot.action}
              onClick={hotspot.onAdvance}
              className={`${shape} bg-accent/60 transition-colors hover:bg-accent ${HOTSPOT_RING}`}
            >
              {content}
              <PingDot className="-left-1.5 -top-1.5" />
            </button>
          )
        }
        return (
          <div key={row.name} className={shape}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export const LINE_TABS: Record<LineProvider, readonly LineTabId[]> = {
  web: ['conexao', 'grupos', 'ajustes'],
  oficial: ['conexao', 'templates', 'ajustes'],
}

/**
 * Casca de `configuracoes/page.tsx`: voltar, título com selos e abas (as abas
 * mudam com o provedor). `tabHotspot` transforma uma aba no elemento destacado.
 */
export function LinhaPage({
  name,
  provider = 'web',
  connected,
  device,
  activeTab,
  tabHotspot,
  children,
}: {
  name?: string
  provider?: LineProvider
  connected: boolean
  /** Linha abaixo do título quando conectada ("Aparelho conectado: …"). */
  device?: string
  activeTab: LineTabId
  tabHotspot?: ScreenProps & { tab: LineTabId }
  children: React.ReactNode
}) {
  const { shared } = useLpContent()

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <span className="w-fit text-sm text-primary">
          {shared.backToConnections}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold tracking-tight text-foreground">
            {name ?? shared.defaultLineName}
          </p>
          <ProviderBadge provider={provider} />
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              connected
                ? 'bg-primary/10 text-primary'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {connected ? shared.connected : shared.disconnected}
          </span>
        </div>
        {connected && device && (
          <p className="text-sm text-muted-foreground">{device}</p>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {LINE_TABS[provider].map(tab => {
          const active = tab === activeTab
          const base = `relative shrink-0 rounded-t-lg px-3 py-2 text-sm ${
            active
              ? 'bg-card font-semibold text-primary'
              : 'font-medium text-muted-foreground'
          }`
          if (tabHotspot?.tab === tab) {
            return (
              <button
                key={tab}
                type="button"
                data-hotspot
                aria-label={tabHotspot.action}
                onClick={tabHotspot.onAdvance}
                className={`${base} hover:bg-accent hover:text-foreground ${HOTSPOT_RING}`}
              >
                {shared.lineTabs[tab]}
                <PingDot />
              </button>
            )
          }
          return (
            <span key={tab} className={base}>
              {shared.lineTabs[tab]}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </span>
          )
        })}
      </div>

      {children}
    </div>
  )
}

/** `ConfigCard`: moldura das seções da configuração. */
export function ConfigCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  /** Botões à direita do cabeçalho. */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="w-full rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{title}</p>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </header>
      <div className="flex flex-col px-5 py-4">{children}</div>
    </section>
  )
}

/** Card de escolha do conector (`ProviderOption` do `trial-card` e da nova linha). */
export function ProviderOption({
  label,
  hint,
  selected = false,
  children,
}: {
  label: string
  hint: string
  selected?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={`flex flex-1 flex-col gap-3 rounded-lg border p-4 ${
        selected ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  )
}
