'use client'

import { useConnectors } from '@/app/hooks/use-connectors'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'

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
  t: (key: string) => string,
): MenuItem[] {
  const btnText = isConnected ? t('menu.desconectar') : t('menu.conectar')

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
        if (!isConnected) {
          control.connect.open(conn)
          await fetchQrCode(conn.id)
        } else {
          control.disconnect.open(conn)
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

function MoreOptionsIcon() {
  return (
    <svg
      className="h-4 w-4 text-gray-600"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  )
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
  const {
    name,
    vinculatedChannelName,
    paidStatus,
    connected: isConnected,
  } = conn.instance

  const isPaid = paidStatus === 'PAID' || paidStatus === 'TRIAL'
  const bgColor = isConnected ? '#DCFCE7' : '#FEE2E2'
  const statusColor = isConnected ? '#144A1B' : '#7A1818'
  const statusText = isConnected ? t('status.ativo') : t('status.inativo')

  const menuItems = buildConnectorMenuItems(
    conn,
    isConnected,
    control,
    fetchQrCode,
    onSolicitarCancelamento,
    connectorId =>
      router.push(`/thinkzap/conexoes/${connectorId}/configuracoes`),
    t,
  )

  return (
    <div
      className={`p-4 transition-colors hover:bg-gray-50 ${
        showBorderBottom ? 'border-b border-gray-100' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() =>
              router.push(`/thinkzap/conexoes/${conn.id}/configuracoes`)
            }
            className="cursor-pointer truncate text-left text-base font-semibold text-black transition-colors hover:text-[#5A997E]"
          >
            {name || t('semNome')}
          </button>
          <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
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
            className="rounded px-2 py-0.5 text-xs font-medium"
            style={{ color: statusColor, backgroundColor: bgColor }}
          >
            {statusText}
          </span>
        </div>

        <div className="relative z-20 flex w-16 shrink-0 justify-end">
          <button
            type="button"
            onClick={() => control.menu.toggle(conn.id)}
            className="cursor-pointer rounded-md border border-gray-200 p-1.5 transition-colors hover:bg-[#d9fce6]"
            title="Mais opções"
          >
            <MoreOptionsIcon />
          </button>

          {control.menu.openConnectorId === conn.id && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-0.5 shadow-md">
              {menuItems.map(item => (
                <button
                  key={item.label}
                  type="button"
                  disabled={!isPaid}
                  onClick={() => {
                    void item.onClick()
                    control.menu.close()
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs text-black transition-colors hover:bg-[#d9fce6] ${
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
