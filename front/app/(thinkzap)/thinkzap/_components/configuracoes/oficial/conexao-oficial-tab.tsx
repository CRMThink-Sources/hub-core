'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import { useLineApi, type LineConnection } from '@/app/hooks/use-line-api'
import { useAplicationContext } from '@/providers/aplication-provider'
import { connectHubMessageChannel } from '../../../_lib/connect-hubmessage-channel'
import { ConfigCard } from '../config-card'
import { LinhaBloqueadaAviso } from '../linha-bloqueada-aviso'

const NAMESPACE = 'thinkzap/configuracoes/conexao-oficial'

type Props = {
  /** Id do item de assinatura — a linha oficial. */
  itemId: string
  /** Canal na HubMessage, do `providerRef` da linha. O SDK precisa dele. */
  channelId: string
  /** Avisa a casca quando o estado da conexão muda, para o cabeçalho acompanhar. */
  onConnectionChange?: (connection: LineConnection | null) => void
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; connection: LineConnection }

/**
 * Aba de conexão da linha oficial (WhatsApp Oficial / HubMessage).
 *
 * É o par da aba Z-API: lá o cliente lê um QR code, aqui ele autentica a própria
 * conta Meta pelo embedded signup, que o SDK `@hubmessage/connect` abre dentro do
 * iframe do Bitrix.
 *
 * Conectada, mostra a WABA — é ela que os templates usam, e é o que identifica a
 * conta ligada ao canal. Não há telefone nem foto de perfil: o que a HubMessage
 * devolve é o `phoneId`, que não é o número do cliente.
 */
export function ConexaoOficialTab({
  itemId,
  channelId,
  onConnectionChange,
}: Props) {
  const { t } = useTranslation(NAMESPACE)
  const api = useLineApi(itemId)
  const { refresh } = useAplicationContext()

  const [state, setState] = useState<State>({ status: 'loading' })
  const [conectando, setConectando] = useState(false)

  const loadConnection = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const connection = await api.getConnection()
      setState({ status: 'ready', connection })
      onConnectionChange?.(connection)
      return connection
    } catch (err: unknown) {
      setState({
        status: 'error',
        message: extractThinkzapError(err, t('erroEstado')),
      })
      onConnectionChange?.(null)
      return null
    }
  }, [api, onConnectionChange, t])

  useEffect(() => {
    void loadConnection()
  }, [loadConnection])

  /**
   * Cada desfecho do SDK vira uma mensagem própria.
   *
   * O SDK resolve `{ success: false }` tanto em cancelamento quanto em origem fora
   * da allowlist do canal, e `connectHubMessageChannel` separa os dois antes de
   * acioná-lo — sem isso o cliente veria "você cancelou" sobre algo que não fez.
   */
  async function handleConectar() {
    setConectando(true)
    try {
      const result = await connectHubMessageChannel({ itemId, channelId })

      switch (result.outcome) {
        case 'connected':
          if (result.wabaRecorded) {
            toast.success(t('conectado'))
          } else {
            // Conectou no provider e a linha não recebeu a WABA: os templates
            // recusam até ela existir, então a tela não pode dizer "pronto".
            toast.warning(t('conectadoSemWaba'))
          }
          /**
           * A WABA vive no item da SPA, que é o que o contexto carrega — sem este
           * `refresh`, a aba Templates continuaria dizendo que o canal não foi
           * conectado até um F5.
           */
          await refresh()
          await loadConnection()
          break
        case 'cancelled':
          toast.info(t('cancelado'))
          break
        case 'missing-config':
          toast.error(t('semConfiguracao'))
          break
        case 'origin-not-allowed':
          toast.error(t('origemNaoAutorizada', { origem: result.origin }))
          break
        case 'incomplete':
          toast.error(t('retornoIncompleto'))
          break
      }
    } catch (err: unknown) {
      toast.error(extractThinkzapError(err, t('erroConectar')))
    } finally {
      setConectando(false)
    }
  }

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
          <p className="text-sm font-medium">{t('erroEstadoTitulo')}</p>
          <p className="mt-1 text-sm">{state.message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-fit"
          onClick={() => void loadConnection()}
        >
          {t('tentarNovamente')}
        </Button>
      </ConfigCard>
    )
  }

  const { connection } = state
  const bloqueada = connection.entitlement !== 'active'

  /**
   * Bloqueada e desconectada: explica, e não oferece a conexão — do mesmo modo que
   * a linha não oficial esconde o QR code. Conectar aqui devolveria ao cliente uma
   * linha que o bloqueio recusa em todo caminho de mensagem, e a rota recusa.
   */
  if (bloqueada && !connection.connected) {
    return (
      <ConfigCard title={t('titulo')} description={t('descricaoDesconectado')}>
        <LinhaBloqueadaAviso
          entitlement={connection.entitlement as 'trial-expired' | 'inactive'}
          namespace={NAMESPACE}
        />
      </ConfigCard>
    )
  }

  if (!connection.connected) {
    return (
      <ConfigCard title={t('titulo')} description={t('descricaoDesconectado')}>
        <div className="flex flex-col items-start gap-4">
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t('instrucao')}
          </p>

          <Button
            type="button"
            disabled={conectando}
            onClick={() => void handleConectar()}
          >
            {conectando && (
              <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {t('conectar')}
          </Button>
        </div>
      </ConfigCard>
    )
  }

  return (
    <ConfigCard title={t('titulo')} description={t('descricaoConectado')}>
      {/**
       * Conectada e bloqueada existe: o bloqueio não desconecta o canal oficial, e
       * a tela diz a verdade das duas coisas em vez de escolher uma.
       */}
      {bloqueada && (
        <div className="mb-6">
          <LinhaBloqueadaAviso
            entitlement={connection.entitlement as 'trial-expired' | 'inactive'}
            namespace={NAMESPACE}
          />
        </div>
      )}

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {connection.wabaId && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('campos.waba')}
            </dt>
            <dd className="mt-0.5 break-all text-sm text-foreground">
              {connection.wabaId}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
        {t('conectadoHint')}
      </p>
    </ConfigCard>
  )
}
