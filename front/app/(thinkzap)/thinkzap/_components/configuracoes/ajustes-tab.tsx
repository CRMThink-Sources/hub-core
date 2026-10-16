'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { useAplicationContext } from '@/providers/aplication-provider'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import { extractLineBlocked } from '@/app/hooks/extract-line-blocked'
import {
  useLineApi,
  type DailyLimitUsage,
  type LineEntitlement,
  type LineSettings,
  type LineSettingsToggles,
} from '@/app/hooks/use-line-api'
import {
  contarAlteracoes,
  limiteDiarioDe,
  limiteDiarioValido,
  patchLimiteDiario,
  TOGGLE_KEYS,
  type AjustesEditaveis,
  type LimiteDiarioEditavel,
  type ToggleKey,
} from './ajustes-alteracoes'
import { ConfigCard } from './config-card'
import { ConfirmModal } from './confirm-modal'
import { LimiteDiarioCard } from './limite-diario-card'
import { LinhaBloqueadaAviso } from './linha-bloqueada-aviso'
import { SaveChangesBar } from './save-changes-bar'

type Props = {
  itemId: string
  /**
   * Avisa a página quando passa a haver (ou deixa de haver) alteração não salva.
   *
   * Trocar de aba desmonta esta — e o que foi digitado some junto. Quem troca de
   * aba é a página, então é ela que precisa saber para pedir confirmação.
   */
  onDirtyChange?: (dirty: boolean) => void
  /**
   * O limite diário só existe na linha não oficial (Z-API). Vem da página, que já sabe o
   * provider para escolher as abas — inferir pela resposta esconderia o card sem
   * motivo visível se a api mudasse.
   */
  provider?: 'ZAPI' | 'HUBMESSAGE'
}

type OpenChannel = { id: string; name: string }

/**
 * Sem `not-provisioned`: toggles e vínculo de canal vivem os dois no item de
 * assinatura, então não há mais estado em que parte da aba fique indisponível.
 */
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready'
      name: string
      vinculatedChannel: string | null
      settings: LineSettingsToggles
      /**
       * Nunca `error` quando bloqueada: a leitura passa, e a aba abre mostrando o
       * que o cliente configurou. Sumir com ela faria trial vencido parecer perda de
       * dado.
       */
      entitlement: LineEntitlement
      /** Só na linha não oficial. */
      limiteDiario?: LimiteDiarioEditavel
      /** Uso do dia; `null` quando o contador não pôde ser lido. */
      uso: DailyLimitUsage | null
    }

/**
 * Aba de ajustes: tudo que é configuração **persistida** da linha.
 *
 * Herdou o conteúdo da antiga aba Geral e ganhou o que estava em modais na lista —
 * vincular e desvincular canal aberto. Sem isso, uma linha nova não teria como ser
 * ligada ao canal do Bitrix, e mensagem nenhuma chegaria ao CRM.
 */
export function AjustesTab({ itemId, onDirtyChange, provider }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/ajustes')
  const api = useLineApi(itemId)
  const { refresh } = useAplicationContext()

  const [state, setState] = useState<State>({ status: 'loading' })
  const [inicial, setInicial] = useState<AjustesEditaveis | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [canais, setCanais] = useState<OpenChannel[]>([])
  const [canaisLoading, setCanaisLoading] = useState(false)
  const [canalSelecionado, setCanalSelecionado] = useState<string>('')
  const [vinculando, setVinculando] = useState(false)
  const [confirmarDesvincular, setConfirmarDesvincular] = useState(false)

  const aplicar = useCallback(
    (data: LineSettings) => {
      // Defensivo: api anterior ao limite não manda os campos.
      const limiteDiario =
        provider === 'ZAPI'
          ? limiteDiarioDe({
              dailyLimitEnabled: data.settings.dailyLimitEnabled === true,
              dailyLimit: data.settings.dailyLimit ?? null,
            })
          : undefined

      setState({
        status: 'ready',
        name: data.name,
        vinculatedChannel: data.vinculatedChannel,
        settings: data.settings,
        entitlement: data.entitlement,
        limiteDiario,
        uso: data.dailyLimit ?? null,
      })
      setInicial({ name: data.name, settings: data.settings, limiteDiario })
    },
    [provider],
  )

  /**
   * Recusa que chegou da api, e não do estado lido.
   *
   * A linha pode ter expirado **entre** abrir a aba e clicar em salvar — o contexto
   * tem cache de 5 minutos. Quando isso acontece, o aviso vem do erro e a aba se
   * trava na hora, em vez de deixar o usuário insistir num botão que só devolve
   * `402`.
   */
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
        t(
          bloqueio === 'trial-expired'
            ? 'bloqueada.trialTitulo'
            : 'bloqueada.inativaTitulo',
        ),
      )
    },
    [t],
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

  const carregarCanais = useCallback(async () => {
    setCanaisLoading(true)
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      const res = await client.get<{ channels?: OpenChannel[] }>(
        '/thinkzap/openchannels',
      )
      setCanais(res.channels ?? [])
    } catch (err: unknown) {
      toast.error(extractThinkzapError(err, t('erroCanais')))
      setCanais([])
    } finally {
      setCanaisLoading(false)
    }
  }, [t])

  /**
   * Carrega os canais **também** quando já existe vínculo.
   *
   * O item guarda só o id do canal (`132`); o nome de exibição vive no Bitrix. Sem
   * a lista, `nomeCanal` não tinha onde resolver e caía no fallback do id cru — a
   * tela mostrava "132" em vez do nome que o operador reconhece.
   *
   * Roda uma vez por montagem da aba, atrelado ao `itemId`: sem essa dependência
   * fixa, o efeito dispararia a cada mudança de `state` (inclusive as do próprio
   * carregamento) e entraria em laço.
   */
  useEffect(() => {
    void carregarCanais()
  }, [itemId, carregarCanais])

  /**
   * Calculado antes dos retornos antecipados: os efeitos abaixo dependem dele, e
   * hook não pode ficar depois de `return`.
   */
  const dirtyCount =
    state.status === 'ready' && inicial !== null
      ? contarAlteracoes(inicial, state)
      : 0
  const dirty = dirtyCount > 0

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  /** Desmontar com pendência (salvou e saiu, ou descartou na troca de aba) não é mais pendência. */
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  /**
   * Fechar ou recarregar a página com alteração pendente: aviso nativo do
   * navegador. O texto é do navegador — os atuais ignoram mensagem própria.
   */
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

  const nomeMudou =
    inicial !== null && state.name.trim() !== inicial.name.trim()
  const nomeValido = state.name.trim().length > 0
  const limiteValido = limiteDiarioValido(state.limiteDiario)
  const podeSalvar = dirty && nomeValido && limiteValido && !bloqueada
  const limiteGravadoAtivo =
    inicial?.limiteDiario !== undefined &&
    inicial.limiteDiario.ativo &&
    limiteDiarioValido(inicial.limiteDiario)

  function setLimiteDiario(patch: Partial<LimiteDiarioEditavel>) {
    setState(prev =>
      prev.status === 'ready' && prev.limiteDiario
        ? { ...prev, limiteDiario: { ...prev.limiteDiario, ...patch } }
        : prev,
    )
  }

  function setToggle(key: ToggleKey, value: boolean) {
    setState(prev =>
      prev.status === 'ready'
        ? { ...prev, settings: { ...prev.settings, [key]: value } }
        : prev,
    )
  }

  async function handleSalvar() {
    if (!podeSalvar || inicial === null || state.status !== 'ready') return

    // Só o que mudou vai no payload.
    const settings: Partial<LineSettingsToggles> = {
      ...patchLimiteDiario(inicial, state),
    }
    for (const key of TOGGLE_KEYS) {
      if (state.settings[key] !== inicial.settings[key]) {
        settings[key] = state.settings[key]
      }
    }
    const limiteMudou =
      'dailyLimitEnabled' in settings || 'dailyLimit' in settings

    setSalvando(true)
    try {
      await api.updateSettings({
        ...(nomeMudou && { name: state.name.trim() }),
        ...(Object.keys(settings).length > 0 && { settings }),
      })
      // Salvou: o que está na tela passa a ser o estado inicial.
      setInicial({
        name: state.name.trim(),
        settings: state.settings,
        limiteDiario: state.limiteDiario && {
          ativo: state.limiteDiario.ativo,
          valor: state.limiteDiario.valor.trim(),
        },
      })
      toast.success(t('salvo'))

      // Limite novo muda o efetivo e o percentual: relê o uso, que a api calcula.
      if (limiteMudou) void recarregarUso()

      /**
       * Nome novo: recarrega o contexto da instalação.
       *
       * O nome da linha aparece fora desta aba — na lista de conexões, no
       * cabeçalho desta tela e no seletor de linhas do widget —, e o contexto é
       * lido uma vez por montagem do provider. Sem o recarregamento a gravação
       * funciona e o cliente não vê, que é indistinguível de não ter salvado.
       *
       * Só quando o nome mudou: toggle nenhum aparece fora daqui, e recarregar
       * por eles pagaria a releitura do contexto por nada.
       *
       * Fora do fluxo de erro do salvamento, e sem desfazer nada: o sucesso já foi
       * confirmado e o estado inicial já foi atualizado. Falha aqui deixa a tela
       * desatualizada — que é o estado de antes desta linha existir —, e o próprio
       * provider reporta o erro de leitura pelo estado dele.
       */
      if (nomeMudou) void refresh().catch(() => undefined)
    } catch (err: unknown) {
      // O que o usuário digitou fica: nada é revertido em falha.
      tratarRecusa(err, t('erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  /** Volta ao que está gravado, sem ir à api. */
  function handleDescartar() {
    if (inicial === null) return

    setState(prev =>
      prev.status === 'ready'
        ? {
            ...prev,
            name: inicial.name,
            settings: { ...prev.settings, ...inicial.settings },
            limiteDiario: inicial.limiteDiario,
          }
        : prev,
    )
  }

  /** Só o uso: o resto da tela pode ter edição pendente, que não pode ser apagada. */
  async function recarregarUso() {
    try {
      const data = await api.getSettings()
      setState(prev =>
        prev.status === 'ready'
          ? { ...prev, uso: data.dailyLimit ?? null }
          : prev,
      )
    } catch {
      // Uso desatualizado é o estado de antes do salvamento; não vale um erro.
    }
  }

  /** Ação imediata: não passa pela barra. Relança para o diálogo ficar aberto. */
  async function handleLiberar(quantidade: number) {
    try {
      const { dailyLimit } = await api.releaseDailyLimitExtra(quantidade)
      setState(prev =>
        prev.status === 'ready' ? { ...prev, uso: dailyLimit } : prev,
      )
      toast.success(t('limiteDiario.liberado', { amount: quantidade }))
    } catch (err: unknown) {
      tratarRecusa(err, t('limiteDiario.erroLiberar'))
      throw err
    }
  }

  async function handleVincular() {
    const lineId = Number(canalSelecionado)
    if (!Number.isFinite(lineId) || lineId <= 0) return

    setVinculando(true)
    try {
      const result = await api.linkChannel(lineId)
      setState(prev =>
        prev.status === 'ready'
          ? { ...prev, vinculatedChannel: result.vinculatedChannel }
          : prev,
      )
      setCanalSelecionado('')
      toast.success(t('canalVinculado'))
    } catch (err: unknown) {
      tratarRecusa(err, t('erroVincular'))
    } finally {
      setVinculando(false)
    }
  }

  async function handleDesvincular() {
    setVinculando(true)
    try {
      await api.unlinkChannel()
      setState(prev =>
        prev.status === 'ready' ? { ...prev, vinculatedChannel: null } : prev,
      )
      setConfirmarDesvincular(false)
      toast.success(t('canalDesvinculado'))
    } catch (err: unknown) {
      setConfirmarDesvincular(false)
      tratarRecusa(err, t('erroDesvincular'))
    } finally {
      setVinculando(false)
    }
  }

  const temCanal = state.vinculatedChannel !== null

  /**
   * Nome de exibição do canal, resolvido pela lista do Bitrix.
   *
   * `String(c.id)` de propósito: o id do canal chega de `crm` como número em
   * `ID`, e o vínculo é guardado como string no item — comparar direto falhava
   * silenciosamente e caía no fallback.
   *
   * Enquanto a lista carrega, não mostra o id: o número cru não diz nada ao
   * operador. Depois de carregada e sem correspondência, o id **é** a informação
   * honesta — o canal foi apagado no Bitrix e é isso que o vínculo aponta.
   */
  const canalVinculado = canais.find(
    c => String(c.id) === state.vinculatedChannel,
  )
  const nomeCanal = canalVinculado
    ? canalVinculado.name
    : canaisLoading
      ? t('carregandoCanais')
      : state.vinculatedChannel

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Antes de tudo: o motivo do travamento vem antes dos campos travados. */}
        {bloqueada && (
          <LinhaBloqueadaAviso
            entitlement={
              state.entitlement as Exclude<LineEntitlement, 'active'>
            }
            namespace="thinkzap/configuracoes/ajustes"
          />
        )}

        <ConfigCard title={t('identificacao')} description={t('nomeHint')}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="line-name">{t('nome')}</Label>
            <Input
              id="line-name"
              value={state.name}
              disabled={bloqueada}
              onChange={e =>
                setState(prev =>
                  prev.status === 'ready'
                    ? { ...prev, name: e.target.value }
                    : prev,
                )
              }
              className="max-w-sm"
            />
            {!nomeValido && (
              <p className="text-sm text-destructive">{t('nomeObrigatorio')}</p>
            )}
          </div>
        </ConfigCard>

        <ConfigCard title={t('canalAberto')} description={t('canalAbertoHint')}>
          {temCanal ? (
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {nomeCanal}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('canalVinculadoHint')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={vinculando || bloqueada}
                onClick={() => setConfirmarDesvincular(true)}
              >
                {t('desvincular')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {t('semCanalVinculado')}
              </p>
              {canaisLoading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  <span className="text-sm text-muted-foreground">
                    {t('carregandoCanais')}
                  </span>
                </div>
              ) : canais.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('nenhumCanalDisponivel')}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={canalSelecionado}
                    disabled={bloqueada}
                    onChange={e => setCanalSelecionado(e.target.value)}
                    className="h-9 max-w-sm rounded-md border border-border bg-background px-3 text-sm disabled:opacity-50"
                  >
                    <option value="">{t('selecioneCanal')}</option>
                    {canais.map(canal => (
                      <option key={canal.id} value={canal.id}>
                        {canal.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    disabled={!canalSelecionado || vinculando || bloqueada}
                    onClick={() => void handleVincular()}
                  >
                    {t('vincular')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ConfigCard>

        <ConfigCard title={t('comportamento')}>
          <div className="flex flex-col gap-4">
            <Toggle
              id="prefix-operator"
              checked={state.settings.prefixOperatorNameEnabled}
              onChange={v => setToggle('prefixOperatorNameEnabled', v)}
              label={t('toggles.prefixOperatorName')}
              hint={t('toggles.prefixOperatorNameHint')}
              disabled={bloqueada}
            />

            <Toggle
              id="widget-open-channel"
              checked={state.settings.widgetOpenChannelEnabled}
              onChange={v => setToggle('widgetOpenChannelEnabled', v)}
              label={t('toggles.widgetOpenChannel')}
              /* Sem canal vinculado não há para onde enviar. */
              disabled={!temCanal || bloqueada}
              hint={
                temCanal
                  ? t('toggles.widgetOpenChannelHint')
                  : t('toggles.widgetOpenChannelSemCanal')
              }
            />
          </div>
        </ConfigCard>

        {state.limiteDiario && (
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
        )}

        {/* Uma barra para a aba inteira: nome, toggles e limite diário saem juntos.
            Vincular canal e liberar limite temporário continuam ações imediatas. */}
        <SaveChangesBar
          dirtyCount={dirtyCount}
          saving={salvando}
          canSave={podeSalvar}
          onSave={() => void handleSalvar()}
          onDiscard={handleDescartar}
        />
      </div>

      <ConfirmModal
        isOpen={confirmarDesvincular}
        title={t('confirmarDesvincularTitulo')}
        message={t('confirmarDesvincularDescricao')}
        confirmLabel={t('desvincular')}
        cancelLabel={t('cancelar')}
        loading={vinculando}
        onClose={() => setConfirmarDesvincular(false)}
        onConfirm={() => void handleDesvincular()}
      />
    </>
  )
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  id: string
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={next => onChange(next === true)}
      />
      <div className="min-w-0">
        <Label
          htmlFor={id}
          className={disabled ? 'text-muted-foreground' : undefined}
        >
          {label}
        </Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}
