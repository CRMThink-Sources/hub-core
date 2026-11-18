'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { isBitrixAdmin } from '@/bitrix'
import { Button } from '@/components/ui/button'
import { useThinkzapAccess } from '@/app/hooks/use-thinkzap-permissions'
import {
  useInsightsConfig,
  useInsightsDashboard,
  useInsightsStatus,
  useInsightsToday,
} from '@/app/hooks/use-insights'
import type {
  DashboardQuery,
  InsightsConfig,
  SeriesGranularity,
  TeamGranularity,
} from '@/app/hooks/insights-types'
import { defaultPeriod } from '@/lib/insights-format'
import {
  InsightsFilters,
  type InsightsFilterState,
} from './_components/insights-filters'
import { PerformancePanel } from './_components/performance-panel'
import { SettingsDialog } from './_components/settings-dialog'
import {
  ErrorBox,
  KeyRevokedBanner,
  LeanBanner,
  LoadingBox,
} from './_components/states'
import { TodayPanel } from './_components/today-panel'

type Tab = 'today' | 'performance'

/**
 * ThinkZap Insights: porta do painel `index.html` original para o front do
 * ThinkZap. Duas abas como lá: "Agora" (quem cobrar neste momento) e
 * "Desempenho" (período, filtros, indicadores, gráficos e listas).
 *
 * O Desempenho só é lido quando a aba é aberta: cada leitura percorre as
 * conversas do período no Bitrix, e quem entra só para ver o "Agora" não
 * precisa pagar esse custo.
 */
export default function InsightsPage() {
  const { t } = useTranslation('thinkzap/insights')
  const access = useThinkzapAccess()
  const isAdmin = access?.canManageAccess === true || isBitrixAdmin()

  const [tab, setTab] = useState<Tab>('today')
  const [performanceOpened, setPerformanceOpened] = useState(false)
  const [filters, setFilters] = useState<InsightsFilterState>(() => ({
    ...defaultPeriod(new Date()),
    dept: '',
    operator: '',
  }))
  const [gran, setGran] = useState<TeamGranularity>('total')
  const [seriesGran, setSeriesGran] = useState<SeriesGranularity>('day')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const cfg = useInsightsConfig(t('state.configError'))
  // O alerta do "Agora" usa o tempo de referência configurado; se a leitura da
  // configuração falhar, a API usa o padrão dela em vez de travar a aba.
  const configSettled = cfg.config !== null || cfg.error !== null
  const today = useInsightsToday(
    cfg.config?.refMin ?? null,
    configSettled,
    t('state.loadError'),
  )

  const query = useMemo<DashboardQuery | null>(
    () =>
      performanceOpened
        ? {
            from: filters.from,
            to: filters.to,
            dept: filters.dept,
            operator: filters.operator,
            g: gran,
            sg: seriesGran,
          }
        : null,
    [performanceOpened, filters, gran, seriesGran],
  )
  const dashboard = useInsightsDashboard(query, t('state.loadError'))

  const mode = dashboard.data?.mode ?? today.data?.mode ?? null

  // Aviso de chave revogada: só admin busca o status, e só quando o painel já
  // caiu para o modo enxuto (com o modo completo não há o que avisar).
  const status = useInsightsStatus(
    isAdmin && mode === 'lean',
    t('state.loadError'),
  )
  const keyRevoked =
    isAdmin && mode === 'lean' && status.data?.keyProblem === 'revoked'

  function openTab(next: Tab) {
    setTab(next)
    if (next === 'performance') setPerformanceOpened(true)
  }

  async function saveConfig(patch: Partial<InsightsConfig>) {
    const result = await cfg.save(patch, t('state.saveError'))
    if (result.ok) {
      today.reload()
      if (performanceOpened) dashboard.reload()
    }
    return result
  }

  const scopeTitle = useMemo(() => {
    const options = dashboard.data?.filters
    if (filters.operator) {
      const op = options?.operators.find(o => String(o.id) === filters.operator)
      if (op) return op.name
    }
    if (filters.dept) {
      const dept = options?.departments.find(d => d.id === filters.dept)
      if (dept) return t('performance.deptScope', { name: dept.name })
    }
    return t('performance.allTeam')
  }, [dashboard.data, filters, t])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'today', label: t('tabs.today') },
    { id: 'performance', label: t('tabs.performance') },
  ]

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center gap-3 border-b border-border">
        <h1 className="mr-2 text-lg font-semibold">{t('title')}</h1>
        <nav className="flex gap-1" aria-label={t('tabs.ariaLabel')}>
          {tabs.map(item => {
            const active = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => openTab(item.id)}
                className={`relative cursor-pointer rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-card font-semibold text-primary'
                    : 'font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {item.label}
                {active ? (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                ) : null}
              </button>
            )
          })}
        </nav>
        {isAdmin && cfg.config ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-1 ml-auto"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
            {t('settings.open')}
          </Button>
        ) : null}
      </header>

      {keyRevoked ? <KeyRevokedBanner /> : null}
      {mode === 'lean' ? <LeanBanner /> : null}

      {tab === 'today' ? (
        <TodayPanel
          data={today.data}
          loading={today.loading || !configSettled}
          error={today.error}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <InsightsFilters
            value={filters}
            onChange={setFilters}
            options={dashboard.data?.filters ?? null}
          />
          {dashboard.error ? (
            <ErrorBox message={dashboard.error} />
          ) : !dashboard.data ? (
            <LoadingBox />
          ) : (
            <div
              className={
                dashboard.loading ? 'opacity-50 transition-opacity' : undefined
              }
              aria-busy={dashboard.loading}
            >
              <PerformancePanel
                data={dashboard.data}
                scopeTitle={scopeTitle}
                gran={gran}
                onGranChange={setGran}
                seriesGran={seriesGran}
                onSeriesGranChange={setSeriesGran}
                selectedOperator={filters.operator}
                onSelectOperator={id =>
                  setFilters(f => ({ ...f, operator: id }))
                }
              />
            </div>
          )}
        </div>
      )}

      {settingsOpen && cfg.config ? (
        <SettingsDialog
          open
          onOpenChange={setSettingsOpen}
          config={cfg.config}
          sourcesSeen={dashboard.data?.sourcesSeen ?? []}
          onSave={saveConfig}
        />
      ) : null}
    </div>
  )
}
