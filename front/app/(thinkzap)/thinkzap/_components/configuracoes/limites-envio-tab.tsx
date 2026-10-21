'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import { extractLineBlocked } from '@/app/hooks/extract-line-blocked'
import {
  useLineApi,
  type CadenceState,
  type DailyLimitUsage,
  type LineEntitlement,
  type LineSettings,
} from '@/app/hooks/use-line-api'
import { CadenciadorCard } from './cadenciador-card'
import { ConfigCard } from './config-card'
import { LimiteDiarioCard } from './limite-diario-card'
import {
  cadenciaDe,
  cadenciaValida,
  contarAlteracoesLimites,
  limiteDiarioDe,
  limiteDiarioValido,
  patchLimites,
  type CadenciaEditavel,
  type LimiteDiarioEditavel,
  type LimitesEditaveis,
} from './limites-alteracoes'
import { LinhaBloqueadaAviso } from './linha-bloqueada-aviso'
import { SaveChangesBar } from './save-changes-bar'

type Props = {
  itemId: string
  /** Mesmo papel do da aba Ajustes: a página pede confirmação ao trocar de aba. */
  onDirtyChange?: (dirty: boolean) => void
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({
      status: 'ready'
      entitlement: LineEntitlement
      /** Uso do dia; `null` quando o contador não pôde ser lido. */
      uso: DailyLimitUsage | null
      /** Estado da cadência; `null` quando não pôde ser lido. */
      cadenciaEstado: CadenceState | null
    } & LimitesEditaveis)

const limitesDe = (data: LineSettings): LimitesEditaveis => ({
  // Defensivo: api anterior aos campos não os manda.
  limiteDiario: limiteDiarioDe({
    dailyLimitEnabled: data.settings.dailyLimitEnabled === true,
    dailyLimit: data.settings.dailyLimit ?? null,
  }),
  cadencia: cadenciaDe(data.settings),
})

/**
 * Aba Limites de envio da linha não oficial (Z-API): o limite diário (quanto a linha
 * envia no dia) e o cadenciador (o ritmo). Os dois vêm desligados e são
 * independentes; a barra de salvamento cobre os dois.
 */
export function LimitesEnvioTab({ itemId, onDirtyChange }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/limites')
  const { t: tAjustes } = useTranslation('thinkzap/configuracoes/ajustes')
  const api = useLineApi(itemId)

  const [state, setState] = useState<State>({ status: 'loading' })
  const [inicial, setInicial] = useState<LimitesEditaveis | null>(null)
  const [salvando, setSalvando] = useState(false)

  const aplicar = useCallback((data: LineSettings) => {
    const limites = limitesDe(data)
    setState({
      status: 'ready',
      entitlement: data.entitlement,
      uso: data.dailyLimit ?? null,
      cadenciaEstado: data.cadence ?? null,
      ...limites,
    })
    setInicial(limites)
  }, [])

  const tratarRecusa = useCallback(
    (err: unknown, fallback: string): void => {
      const bloqueio = extractLineBlocked(err)
      if (bloqueio === null) {
        toast.error(extractThinkzapError(err, fallback))
        return
      }
      setState(prev =>
        prev.status === 'ready' ? { ...prev, entitlement: bloqueio } : prev,
      )
      toast.error(
        tAjustes(
          bloqueio === 'trial-expired'
            ? 'bloqueada.trialTitulo'
            : 'bloqueada.inativaTitulo',
        ),
      )
    },
    [tAjustes],
  )

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      aplicar(await api.getSettings())
    } catch (err: unknown) {
      setState({
        status: 'error',
        message: extractThinkzapError(err, t('erroLeitura')),
      })
    }
  }, [api, aplicar, t])

  useEffect(() => {
    void load()
  }, [load])

  const dirtyCount =
    state.status === 'ready' && inicial !== null
      ? contarAlteracoesLimites(inicial, state)
      : 0
  const dirty = dirtyCount > 0

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [dirty])

  if (state.status === 'loading') {
    return (
      <ConfigCard title={t('titulo')} description={t('descricao')}>
        <div className="flex items-center gap-2 py-8">
          <div className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="text-sm text-muted-foreground">
            {t('carregando')}
          </span>
        </div>
      </ConfigCard>
    )
  }

  if (state.status === 'error') {
    return (
      <ConfigCard title={t('titulo')} description={t('descricao')}>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">{t('erroLeituraTitulo')}</p>
          <p className="mt-1 text-sm">{state.message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-fit"
          onClick={() => void load()}
        >
          {t('tentarNovamente')}
        </Button>
      </ConfigCard>
    )
  }

  const bloqueada = state.entitlement !== 'active'
  // Recurso desligado não valida: os campos dele nem vão no payload.
  const validos =
    limiteDiarioValido(state.limiteDiario) && cadenciaValida(state.cadencia)
  const podeSalvar = dirty && validos && !bloqueada
  const limiteGravadoAtivo =
    inicial !== null &&
    inicial.limiteDiario.ativo &&
    limiteDiarioValido(inicial.limiteDiario)

  function setLimiteDiario(patch: Partial<LimiteDiarioEditavel>) {
    setState(prev =>
      prev.status === 'ready'
        ? { ...prev, limiteDiario: { ...prev.limiteDiario, ...patch } }
        : prev,
    )
  }

  function setCadencia(patch: Partial<CadenciaEditavel>) {
    setState(prev =>
      prev.status === 'ready'
        ? { ...prev, cadencia: { ...prev.cadencia, ...patch } }
        : prev,
    )
  }

  /** Relê uso e estado da cadência sem apagar edição pendente. */
  async function recarregarLeituras() {
    try {
      const data = await api.getSettings()
      setState(prev =>
        prev.status === 'ready'
          ? {
              ...prev,
              uso: data.dailyLimit ?? null,
              cadenciaEstado: data.cadence ?? null,
            }
          : prev,
      )
    } catch {
      // Leitura desatualizada é o estado de antes; não vale um erro.
    }
  }

  async function handleSalvar() {
    if (!podeSalvar || inicial === null || state.status !== 'ready') return

    const settings = patchLimites(inicial, state)
    setSalvando(true)
    try {
      await api.updateSettings({ settings })
      const trim = (v: string) => v.trim()
      setInicial({
        limiteDiario: {
          ...state.limiteDiario,
          valor: trim(state.limiteDiario.valor),
        },
        cadencia: {
          ...state.cadencia,
          mensagens: trim(state.cadencia.mensagens),
          janela: trim(state.cadencia.janela),
          pausa: trim(state.cadencia.pausa),
        },
      })
      toast.success(t('salvo'))
      void recarregarLeituras()
    } catch (err: unknown) {
      tratarRecusa(err, t('erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  function handleDescartar() {
    if (inicial === null) return
    setState(prev => (prev.status === 'ready' ? { ...prev, ...inicial } : prev))
  }

  /** Ação imediata: não passa pela barra. Relança para o diálogo ficar aberto. */
  async function handleLiberar(quantidade: number) {
    try {
      const { dailyLimit } = await api.releaseDailyLimitExtra(quantidade)
      setState(prev =>
        prev.status === 'ready' ? { ...prev, uso: dailyLimit } : prev,
      )
      toast.success(tAjustes('limiteDiario.liberado', { amount: quantidade }))
    } catch (err: unknown) {
      tratarRecusa(err, tAjustes('limiteDiario.erroLiberar'))
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {bloqueada && (
        <LinhaBloqueadaAviso
          entitlement={state.entitlement as Exclude<LineEntitlement, 'active'>}
          namespace="thinkzap/configuracoes/ajustes"
        />
      )}

      <LimiteDiarioCard
        ativo={state.limiteDiario.ativo}
        valor={state.limiteDiario.valor}
        onAtivoChange={ativo => setLimiteDiario({ ativo })}
        onValorChange={valor => setLimiteDiario({ valor })}
        uso={state.uso}
        limiteGravadoAtivo={limiteGravadoAtivo}
        bloqueada={bloqueada}
        onLiberar={handleLiberar}
      />

      <CadenciadorCard
        cadencia={state.cadencia}
        onChange={setCadencia}
        estado={state.cadenciaEstado}
        bloqueada={bloqueada}
      />

      {/* Uma barra para a aba: limite diário e cadência saem juntos. Liberar
          limite temporário continua ação imediata. */}
      <SaveChangesBar
        dirtyCount={dirtyCount}
        saving={salvando}
        canSave={podeSalvar}
        onSave={() => void handleSalvar()}
        onDiscard={handleDescartar}
      />
    </div>
  )
}
