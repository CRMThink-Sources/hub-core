'use client'

import { useConnectors } from '@/app/hooks/use-connectors'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { MoreVerticalIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/providers/session-provider'
import { connectHubMessageChannel } from '../../_lib/connect-hubmessage-channel'

type Connector = any

type ConnectorsControl = ReturnType<typeof useConnectors>

type MenuItem = {
  label: string
  onClick: () => void | Promise<void>
}

function buildConnectorMenuItems(
  conn: Connector,
  isConnected: boolean,
  control: ConnectorsControl,
  fetchQrCode: (connectorId: string) => Promise<void>,
  onSolicitarCancelamento: (payload: { id: string; nome: string }) => void,
  onOpenConfiguracoes: (connectorId: string) => void,
  onConnectHubMessage: () => Promise<void>,
  t: (key: string) => string,
): MenuItem[] {
  const btnText = isConnected ? t('menu.desconectar') : t('menu.conectar')
  const isHubMessage = conn.provider === 'HUBMESSAGE'

  return [
    {
      label: t('menu.configuracoes'),
      onClick: () => {
        onOpenConfiguracoes(conn.id)
      },
    },
    {
      label: btnText,
      onClick: async () => {
        if (isConnected) {
          control.disconnect.open(conn)
          return
        }
        if (isHubMessage) {
          // WhatsApp Oficial: conexão via SDK HubMessage (conta Meta do cliente).
          await onConnectHubMessage()
        } else {
          control.connect.open(conn)
          await fetchQrCode(conn.id)
        }
      },
    },
    {
      label: !conn.instance?.vinculatedChannel
        ? t('menu.vincularCanal')
        : t('menu.desvincularCanal'),
      onClick: () => {
        if (!conn.instance?.vinculatedChannel) {
          control.linkChannel.open(conn)
        } else {
          control.unlinkChannel.open(conn)
        }
      },
    },
    {
      label: t('menu.cancelarConector'),
      onClick: () => {
        onSolicitarCancelamento({
          id: conn.id,
          nome: conn.instance?.name || t('semNome'),
        })
      },
    },
  ]
}

type Props = {
  conn: Connector
  showBorderBottom: boolean
  control: ConnectorsControl
  fetchQrCode: (connectorId: string) => Promise<void>
  onSolicitarCancelamento: (payload: { id: string; nome: string }) => void
}

export function ConexaoRow({
  conn,
  showBorderBottom,
  control,
  fetchQrCode,
  onSolicitarCancelamento,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/conexao-row')
  const router = useRouter()
  const { refreshSession } = useSession()
  const {
    name,
    vinculatedChannelName,
    paidStatus,
    connected: isConnected,
  } = conn.instance

  async function handleConnectHubMessage() {
    try {
      const result = await connectHubMessageChannel({
        connectorId: conn.id,
        channelId: conn.instance?.channelId ?? conn.instanceId,
      })

      switch (result.outcome) {
        case 'connected':
          toast.success(t('conexao.sucesso'))
          await refreshSession()
          return
        case 'cancelled':
          toast.info(t('conexao.cancelada'))
          return
        case 'missing-config':
          toast.error(t('conexao.semConfiguracao'))
          return
        case 'origin-not-allowed':
          toast.error(t('conexao.origemNaoAutorizada'))
          return
        case 'incomplete':
          toast.error(t('conexao.incompleta'))
          return
      }
    } catch (e: unknown) {
      toast.error((e as Error).message)
    }
  }

  const isPaid = paidStatus === 'PAID' || paidStatus === 'TRIAL'
  const isOficial = conn.provider === 'HUBMESSAGE'

  // Canal oficial provisionado mas nunca autenticado na Meta: não é "inativo",
  // é um passo pendente do usuário.
  const isAwaitingConnection =
    isOficial && !isConnected && conn.instance?.status === 'CONNECTING'

  const statusClass = isConnected
    ? 'bg-primary/10 text-primary'
    : isAwaitingConnection
      ? 'bg-muted text-muted-foreground'
      : 'bg-destructive/10 text-destructive'
  const statusText = isConnected
    ? t('status.ativo')
    : isAwaitingConnection
      ? t('status.aguardandoConexao')
      : t('status.inativo')

  const providerClass = isOficial
    ? 'border-primary/30 bg-primary/10 text-primary'
    : 'border-border bg-muted text-muted-foreground'
  const providerText = isOficial
    ? t('provider.oficial')
    : t('provider.naoOficial')

  const menuItems = buildConnectorMenuItems(
    conn,
    isConnected,
    control,
    fetchQrCode,
    onSolicitarCancelamento,
    connectorId =>
      router.push(`/thinkzap/conexoes/${connectorId}/configuracoes`),
    handleConnectHubMessage,
    t,
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/thinkzap/conexoes/${conn.id}/configuracoes`)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ')
          router.push(`/thinkzap/conexoes/${conn.id}/configuracoes`)
      }}
      className={`cursor-pointer p-4 transition-colors hover:bg-accent ${
        showBorderBottom ? 'border-b border-border' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-left text-base font-semibold text-foreground transition-colors hover:text-primary">
              {name || t('semNome')}
            </span>
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${providerClass}`}
            >
              {providerText}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="truncate">
              {vinculatedChannelName || t('nenhumCanalVinculado')}
              {conn.instance.phoneNumber != null &&
              conn.instance.phoneNumber !== ''
                ? ` · ${conn.instance.phoneNumber}`
                : ''}
            </span>
          </div>
        </div>

        <div className="flex flex-1 justify-center">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusText}
          </span>
        </div>

        <div className="relative flex w-16 shrink-0 justify-end">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              control.menu.toggle(conn.id)
            }}
            className="cursor-pointer rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-accent"
            title="Mais opções"
          >
            <MoreVerticalIcon className="size-4" />
          </button>

          {control.menu.openConnectorId === conn.id && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-popover py-0.5 shadow-md">
              {menuItems.map(item => (
                <button
                  key={item.label}
                  type="button"
                  disabled={!isPaid}
                  onClick={e => {
                    e.stopPropagation()
                    void item.onClick()
                    control.menu.close()
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-popover-foreground transition-colors hover:bg-accent ${
                    !isPaid ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                  } `}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
