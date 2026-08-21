'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { APP_CODES } from '@/shared/app/app-codes'
import { appTokenKey } from '@/shared/auth/app-token-storage'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import { TrialContactDialog, type TrialContact } from './trial-contact-dialog'
import { isProviderUnavailable } from './provider-availability'

type TrialProvider = 'ZAPI' | 'HUBMESSAGE'

/** Espelha `ConnectorTrialState` da api. */
type TrialState =
  /** `contact` só existe aqui: é a única variante que rende formulário. */
  | { status: 'available'; providers: TrialProvider[]; contact: TrialContact }
  | { status: 'active'; provider: TrialProvider; currentPeriodEnd: string }
  | { status: 'expired'; provider: TrialProvider; currentPeriodEnd: string }
  | { status: 'unavailable'; reason: string }
  | { status: 'misconfigured' }

type Fetch =
  | { kind: 'loading' }
  | { kind: 'ready'; trial: TrialState }
  | { kind: 'error'; message: string }

/**
 * Convite ao teste, e o estado dele depois de ativado.
 *
 * Só aparece quando há algo a dizer: instalação que já é cliente pagante
 * (`unavailable`) não rende card nenhum, para a tela de conexões não carregar um
 * aviso permanente sobre um teste que nunca vai acontecer.
 *
 * `onActivated` recarrega o contexto da aplicação — a linha nova é um item de
 * assinatura, e a lista de linhas vem de lá.
 */
export function TrialCard({ onActivated }: { onActivated: () => void }) {
  const { t } = useTranslation('thinkzap/conexoes/trial')
  const [state, setState] = useState<Fetch>({ kind: 'loading' })
  const [activating, setActivating] = useState(false)
  /** Provider escolhido, aguardando a confirmação do contato. `null` = sem dialog. */
  const [chosen, setChosen] = useState<TrialProvider | null>(null)
  const [serverField, setServerField] = useState<keyof TrialContact | null>(
    null,
  )

  const load = useCallback(async () => {
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      const res = await client.get<{ trial: TrialState }>('/thinkzap/trial')
      setState({ kind: 'ready', trial: res.trial })
    } catch (err: unknown) {
      setState({
        kind: 'error',
        message: extractThinkzapError(err, t('erroLeitura')),
      })
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * O dialog só fecha em sucesso: erro da api mantém o que foi digitado, e o campo
   * que a api nomeou fica marcado no input.
   */
  async function handleActivate(
    provider: TrialProvider,
    contact: TrialContact,
  ) {
    setActivating(true)
    setServerField(null)
    try {
      const client = axiosThinkzap(appTokenKey(APP_CODES.thinkzap))
      await client.post('/thinkzap/trial', { provider, ...contact })
      toast.success(t('ativado'))
      setChosen(null)
      await load()
      onActivated()
    } catch (err: unknown) {
      setServerField(extractContactField(err))
      toast.error(extractThinkzapError(err, t('erroAtivar')))
    } finally {
      setActivating(false)
    }
  }

  if (state.kind === 'loading') return null

  if (state.kind === 'error') {
    return (
      <Shell tone="amber">
        <p className="text-sm font-medium">{t('erroLeituraTitulo')}</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </Shell>
    )
  }

  const { trial } = state

  // Cliente pagante ou sem espelho na SPA: nada a oferecer, nada a explicar aqui.
  if (trial.status === 'unavailable') return null

  /**
   * Configuração faltando é mostrada, e nomeada: sem isto o cliente veria uma tela
   * sem convite e sem motivo, e o suporte não saberia que o plano de trial é o que
   * está ausente.
   */
  if (trial.status === 'misconfigured') {
    return (
      <Shell tone="amber">
        <p className="text-sm font-medium">{t('indisponivelTitulo')}</p>
        <p className="mt-1 text-sm">{t('indisponivelDescricao')}</p>
      </Shell>
    )
  }

  if (trial.status === 'active') {
    return (
      <Shell tone="blue">
        <p className="text-sm font-medium">{t('emAndamentoTitulo')}</p>
        <p className="mt-1 text-sm">
          {t('emAndamentoDescricao', {
            data: formatDate(trial.currentPeriodEnd),
          })}
        </p>
      </Shell>
    )
  }

  if (trial.status === 'expired') {
    return (
      <Shell tone="amber">
        <p className="text-sm font-medium">{t('expiradoTitulo')}</p>
        <p className="mt-1 text-sm">
          {t('expiradoDescricao', { data: formatDate(trial.currentPeriodEnd) })}
        </p>
      </Shell>
    )
  }

  return (
    <Shell tone="neutral">
      <p className="text-base font-semibold text-foreground">
        {t('convite.titulo')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('convite.descricao')}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {trial.providers.map(provider => {
          /**
           * O conector continua na lista que a api devolve — o gate é de interface,
           * enquanto o teste com a HubMessage não acontece. Ver
           * `provider-availability`.
           */
          const indisponivel = isProviderUnavailable(provider)

          return (
            <ProviderOption
              key={provider}
              provider={provider}
              disabled={activating || indisponivel}
              indisponivel={indisponivel}
              loading={activating && chosen === provider}
              onChoose={() => {
                setServerField(null)
                setChosen(provider)
              }}
              label={t(`convite.${provider}.titulo`)}
              hint={t(`convite.${provider}.descricao`)}
              cta={t('convite.escolher')}
              emBreve={t('convite.emBreve')}
            />
          )
        })}
      </div>

      {chosen ? (
        <TrialContactDialog
          // Remonta ao trocar de provider: o formulário volta ao contato do CRM.
          key={chosen}
          open
          initial={trial.contact}
          submitting={activating}
          serverField={serverField}
          onCancel={() => setChosen(null)}
          onSubmit={contact => void handleActivate(chosen, contact)}
        />
      ) : null}
    </Shell>
  )
}

/**
 * O campo que a api recusou, quando ela nomeia um.
 *
 * `400` de contato inválido devolve `{ error, field }` — o `field` marca o input
 * certo em vez de deixar o cliente adivinhar qual dos quatro corrigir.
 */
function extractContactField(err: unknown): keyof TrialContact | null {
  const field = (
    err as { response?: { data?: { result?: { field?: unknown } } } }
  )?.response?.data?.result?.field

  return field === 'name' ||
    field === 'email' ||
    field === 'phone' ||
    field === 'company'
    ? field
    : null
}

function ProviderOption({
  provider,
  label,
  hint,
  cta,
  emBreve,
  disabled,
  indisponivel,
  loading,
  onChoose,
}: {
  provider: TrialProvider
  label: string
  hint: string
  cta: string
  emBreve: string
  disabled: boolean
  /** Conector ainda não liberado: card apagado, selo e botão travado. */
  indisponivel: boolean
  loading: boolean
  onChoose: () => void
}) {
  return (
    <div
      className={`flex flex-1 flex-col gap-3 rounded-lg border border-border p-4${
        indisponivel ? ' opacity-60' : ''
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {indisponivel ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {emBreve}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      <Button
        type="button"
        className="w-fit"
        disabled={disabled}
        onClick={onChoose}
        data-provider={provider}
        data-unavailable={indisponivel ? 'true' : undefined}
      >
        {loading ? (
          <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : null}
        {indisponivel ? emBreve : cta}
      </Button>
    </div>
  )
}

const TONES = {
  neutral: 'border-border bg-card',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
} as const

function Shell({
  tone,
  children,
}: {
  tone: keyof typeof TONES
  children: React.ReactNode
}) {
  return (
    <div className={`w-full rounded-xl border p-6 ${TONES[tone]}`}>
      {children}
    </div>
  )
}

/**
 * A api devolve a data crua de propósito — fuso e formatação são da tela. `undefined`
 * de locale usa o do navegador, que é o do operador.
 */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}
