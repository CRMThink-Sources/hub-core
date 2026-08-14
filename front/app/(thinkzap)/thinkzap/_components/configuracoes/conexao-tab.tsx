'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { extractThinkzapError } from '@/app/hooks/extract-thinkzap-error'
import {
  useLineApi,
  type LineConnection,
  type LineEntitlement,
} from '@/app/hooks/use-line-api'
import { useLineConnectionStatus } from '@/app/hooks/use-line-connection-status'
import { ConfirmModal } from './confirm-modal'
import { ConfigCard } from './config-card'
import { LinhaBloqueadaAviso } from './linha-bloqueada-aviso'

type Props = {
  itemId: string
  /**
   * Id da linha no provider — para a Z-API, o `instanceId`, que também nomeia a
   * sala do socket. `null` quando a linha ainda não foi provisionada: aí não há
   * sala para entrar, e a releitura periódica é o único caminho.
   */
  providerRef: string | null
  /** Avisa a casca quando o estado da conexão muda, para o cabeçalho acompanhar. */
  onConnectionChange?: (connection: LineConnection | null) => void
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; connection: LineConnection }

/**
 * Aba de conexão da linha.
 *
 * Desconectado: o QR code é buscado e exibido **aqui**, não num modal — ler o QR é
 * o caso mais comum de entrar nesta tela.
 *
 * Conectado: só os campos que o provider devolveu. Nada de placeholder para dado
 * que não existe.
 */
export function ConexaoTab({ itemId, providerRef, onConnectionChange }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/conexao')
  const api = useLineApi(itemId)

  const [state, setState] = useState<State>({ status: 'loading' })
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const [imgFailed, setImgFailed] = useState(false)
  const [confirmarDesconectar, setConfirmarDesconectar] = useState(false)
  const [desconectando, setDesconectando] = useState(false)

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

  /**
   * Releitura de fundo, para os avisos de conexão e para a repetição periódica.
   *
   * Não passa por `loading` nem por `error` de propósito. `loadConnection` troca a
   * tela inteira por um spinner e, na falha, pelo card de erro — a cada oito
   * segundos isso piscaria por cima do QR code que o usuário está tentando ler, e
   * uma falha isolada de rede apagaria o QR em vez de deixar a próxima tentativa
   * resolver. A tela só muda quando há resultado novo.
   */
  const refreshConnection = useCallback(async () => {
    try {
      const connection = await api.getConnection()
      setState({ status: 'ready', connection })
      onConnectionChange?.(connection)
    } catch {
      // Silêncio proposital: o estado anterior continua na tela.
    }
  }, [api, onConnectionChange])

  const loadQrCode = useCallback(async () => {
    setQrLoading(true)
    setQrError(null)
    try {
      const data = await api.getQrCode()
      setQrCode(data.value ?? null)
    } catch (err: unknown) {
      setQrError(extractThinkzapError(err, t('erroQrCode')))
      setQrCode(null)
    } finally {
      setQrLoading(false)
    }
  }, [api, t])

  useEffect(() => {
    void loadConnection()
  }, [loadConnection])

  /**
   * A tela está esperando uma conexão acontecer: é o estado que mostra o QR code.
   *
   * Booleano, e não o objeto `state`, porque a releitura de fundo cria um `state`
   * novo a cada oito segundos — os efeitos abaixo dependeriam de uma identidade que
   * muda sozinha, e o QR seria rebuscado a cada ciclo.
   */
  const aguardandoConexao =
    state.status === 'ready' &&
    !state.connection.connected &&
    state.connection.entitlement === 'active'

  /**
   * QR só quando desconectado **e habilitado**.
   *
   * Buscar conectado gastaria chamada sem uso; buscar bloqueado gastaria uma chamada
   * que a api recusa com `402` — e o `qrError` resultante diria "não foi possível
   * gerar o QR code", que descreve errado o que aconteceu.
   */
  useEffect(() => {
    if (aguardandoConexao) void loadQrCode()
  }, [aguardandoConexao, loadQrCode])

  /**
   * Assinatura enquanto a leitura estiver carregada — inclusive conectada, que é
   * como a tela percebe uma desconexão sem recarga. A releitura periódica fica
   * restrita à espera do pareamento: ela consulta o provider a cada tentativa, e
   * com a linha conectada não há desfecho para esperar.
   */
  useLineConnectionStatus({
    providerRef,
    subscribe: state.status === 'ready',
    poll: aguardandoConexao,
    onChange: () => void refreshConnection(),
  })

  async function handleDesconectar() {
    setDesconectando(true)
    try {
      await api.disconnect()
      setConfirmarDesconectar(false)
      toast.success(t('desconectado'))
      await loadConnection()
    } catch (err: unknown) {
      // Estado anterior preservado: não afirmamos que desconectou.
      toast.error(extractThinkzapError(err, t('erroDesconectar')))
    } finally {
      setDesconectando(false)
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
   * Bloqueada e desconectada: explica, e não oferece o QR code.
   *
   * O `disconnect` na expiração é o que traz a linha para cá — o número foi
   * desconectado no provider de propósito. Mostrar o QR aqui convidaria a reconectar,
   * que é justamente o que o bloqueio impede.
   */
  if (bloqueada && !connection.connected) {
    return (
      <ConfigCard title={t('titulo')} description={t('descricaoDesconectado')}>
        <LinhaBloqueadaAviso
          entitlement={
            connection.entitlement as Exclude<LineEntitlement, 'active'>
          }
          namespace="thinkzap/configuracoes/conexao"
        />
      </ConfigCard>
    )
  }

  if (!connection.connected) {
    return (
      <ConfigCard title={t('titulo')} description={t('descricaoDesconectado')}>
        <div className="flex flex-col items-center gap-4 py-2">
          {qrLoading && (
            <div className="flex size-64 items-center justify-center rounded-lg border border-dashed border-border">
              <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          )}

          {!qrLoading && qrError && (
            <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <p className="text-sm font-medium">{t('erroQrCodeTitulo')}</p>
              <p className="mt-1 text-sm">{qrError}</p>
            </div>
          )}

          {!qrLoading && !qrError && qrCode && (
            <img
              src={qrCode}
              alt={t('qrCodeAlt')}
              className="size-64 rounded-lg border border-border"
            />
          )}

          {!qrLoading && !qrError && !qrCode && (
            <div className="flex size-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              {t('qrCodeIndisponivel')}
            </div>
          )}

          <p className="max-w-sm text-center text-sm text-muted-foreground">
            {t('instrucaoQrCode')}
          </p>

          <Button
            type="button"
            variant="outline"
            disabled={qrLoading}
            onClick={() => void loadQrCode()}
          >
            {t('atualizarQrCode')}
          </Button>
        </div>
      </ConfigCard>
    )
  }

  return (
    <>
      <ConfigCard title={t('titulo')} description={t('descricaoConectado')}>
        {/**
         * Conectada e bloqueada existe: o `disconnect` da expiração é tolerante a
         * falha, então a sessão pode sobreviver alguns minutos. A tela diz a verdade
         * das duas coisas em vez de escolher uma.
         */}
        {bloqueada && (
          <div className="mb-6">
            <LinhaBloqueadaAviso
              entitlement={
                connection.entitlement as Exclude<LineEntitlement, 'active'>
              }
              namespace="thinkzap/configuracoes/conexao"
            />
          </div>
        )}

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {connection.imgUrl && !imgFailed && (
            <img
              src={connection.imgUrl}
              alt={connection.name ?? t('semNome')}
              onError={() => setImgFailed(true)}
              className="size-20 shrink-0 rounded-full border border-border object-cover"
            />
          )}

          <dl className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {connection.name && (
              <Campo label={t('campos.nome')} value={connection.name} />
            )}
            {connection.phone && (
              <Campo label={t('campos.telefone')} value={connection.phone} />
            )}
            {connection.deviceModel && (
              <Campo
                label={t('campos.aparelho')}
                value={connection.deviceModel}
              />
            )}
            {connection.isBusiness !== undefined && (
              <Campo
                label={t('campos.conta')}
                value={
                  connection.isBusiness
                    ? t('campos.contaBusiness')
                    : t('campos.contaPessoal')
                }
              />
            )}
            {connection.about && (
              <div className="sm:col-span-2">
                <Campo label={t('campos.recado')} value={connection.about} />
              </div>
            )}
          </dl>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {t('desconectarHint')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmarDesconectar(true)}
          >
            {t('desconectar')}
          </Button>
        </div>
      </ConfigCard>

      <ConfirmModal
        isOpen={confirmarDesconectar}
        title={t('confirmarDesconectarTitulo')}
        message={t('confirmarDesconectarDescricao')}
        confirmLabel={t('desconectar')}
        cancelLabel={t('cancelar')}
        loading={desconectando}
        onClose={() => setConfirmarDesconectar(false)}
        onConfirm={() => void handleDesconectar()}
      />
    </>
  )
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  )
}
