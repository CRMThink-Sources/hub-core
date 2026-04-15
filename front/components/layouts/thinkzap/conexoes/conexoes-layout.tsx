'use client'

import { useState } from 'react'
import { useSession } from '@/providers/session-provider'
import Link from 'next/link'
import { ConfigurarModal } from '../modals/configurar-modal'
import { ConectarModal } from '../modals/conectar-modal'
import { useQrCode } from '@/app/hooks/use-qr-code'
import { useConnectors } from '@/app/hooks/use-connectors'
import { VincularCanalModal } from '../modals/vincular-canal-modal'
import { DesvincularCanalModal } from '../modals/desvincular-canal-modal'
import { DesconectarModal } from '../modals/desconectar-modal'
import { CancelarConectorModal } from '../modals/cancelar-conector-modal'
import { envConfig } from '@/shared/infra/env-config'
import { getAppRedirectUrl } from '@/app/config/app-redirects'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
import { useConnectorsSocket } from '@/app/hooks/use-connectors-socket'
import { THINKZAP_TRIAL_MAX_CONNECTORS } from '@/shared/constants/thinkzap-trial'
import { AtivarAssinaturaButton } from '../ativar-assinatura-button'

// validar com Joao questoes de numero de telefone, nao encotrei no db.
// const formatPhoneNumber = (phone: string) => {
//   if (!phone) return '-'
//   const match = phone.match(/^\+(\d{2})(\d{2})(\d{5})(\d{4})$/)
//   if (!match) return phone
//   return `+${match[1]} ${match[2]} ${match[3]}-${match[4]}`
// }

export default function ConexoesLayout() {
  const { session, refreshSession } = useSession()
  const { qrCode, loading: qrLoading, fetchQrCode } = useQrCode()
  const [modalCancelarConector, setModalCancelarConector] = useState<{
    id: string
    nome: string
  } | null>(null)

  const {
    openMenuId,
    setOpenMenuId,
    connSelecionado,
    configurarAberto,
    setConfigurarAberto,
    conectarAberto,
    setConectarAberto,
    abrirConfigurar,
    abrirConectar,
    abrirVincular,
    vincularAberto,
    setVincularAberto,
    connVincular,
    setConnVincular,
    abrirDesvincular,
    desvincularAberto,
    setDesvincularAberto,
    connDesvincular,
    abrirDesconectar,
    desconectarAberto,
    setDesconectarAberto,
    connDesconectar,
  } = useConnectors()

  useConnectorsSocket({
    appId: session?.app.id ?? '',
    onDisconnected: () => {
      console.log('connector disconnected')
      void refreshSession()
    },
  })

  const total = session?.connectors.length ?? 0
  const connected =
    session?.connectors.filter((c: any) => c.instance.connected === true)
      .length ?? 0

  const subscription = (session?.subscription ?? null) as {
    status?: string
    connectorQuantity?: number
  } | null
  const connectorQuantity = Number(subscription?.connectorQuantity ?? total)
  const quantityAposCancelamento = Math.max(1, connectorQuantity - 1)
  const bloquearContratarLinhaTrial =
    subscription?.status === 'TRIALING' &&
    total >= THINKZAP_TRIAL_MAX_CONNECTORS

  const handleSave = async (id: string, name: string): Promise<void> => {
    try {
      const authTokenKey = getAppRedirectUrl(
        envConfig.appCodes.thinkzap,
      )?.storageAuthTokenKey
      if (!authTokenKey) return

      const client = axiosThinkzap(authTokenKey)
      await client.put(`${envConfig.apiUrl}/thinkzap/instance/${id}`, {
        name,
      })
      await refreshSession()
    } catch (error) {
      console.error('Erro ao salvar:', error)
    }
    setConfigurarAberto(false)
    setConectarAberto(false)
  }

  const handleCloseConectar = () => {
    setConectarAberto(false)
    void refreshSession()
  }

  return (
    <div className="w-full flex flex-col pt-20 px-6 space-y-6">
      <div className="flex w-full max-w-5xl flex-col gap-4 rounded-lg border border-gray-100 bg-white p-6">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="page-title">Configurações</h1>
            <h2 className="page-subtitle mt-1">
              Gerencie os números de WhatsApp conectados ao Bitrix24
            </h2>
          </div>

          {!bloquearContratarLinhaTrial && (
            <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
              <Link
                className="inline-flex w-full items-center justify-center rounded-lg bg-[#5A997E] px-5 py-2.5 text-center font-medium text-white transition-colors hover:bg-[#4a8169] sm:w-auto"
                href="/thinkzap/financeiro"
              >
                + Contratar linha
              </Link>
            </div>
          )}
        </div>

        {bloquearContratarLinhaTrial && (
          <>
            <div className="w-full rounded-lg border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-left shadow-sm">
              <p className="text-sm leading-relaxed text-amber-950">
                <span className="font-semibold text-amber-900">
                  Limite do trial atingido ({THINKZAP_TRIAL_MAX_CONNECTORS}{' '}
                  conectores).
                </span>{' '}
                Para contratar mais linhas, efetive a assinatura (encerra o
                teste e inicia a cobrança) ou use o portal Stripe para cartão e
                faturas.
              </p>
            </div>
            <div className="flex w-full flex-wrap justify-end gap-2">
              <AtivarAssinaturaButton layout="inline" />
              <Link
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                href="/thinkzap/financeiro"
              >
                Financeiro
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="w-full max-w-5xl">
        <div className="inline-flex items-center gap-2 bg-[#e8fdf0] text-[#5A997E] px-3 py-1.5 rounded-md border border-[#d9fce6] text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Números conectados:{' '}
            <strong>
              {connected}/{total}
            </strong>
          </span>
        </div>
      </div>

      <div className="w-full max-w-5xl bg-white rounded-lg border border-gray-100">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50 rounded-t-lg">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Nome
            </span>
          </div>
          <div className="flex-1 flex justify-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Status
            </span>
          </div>
          <div className="w-16 flex justify-end">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Ações
            </span>
          </div>
        </div>

        {session?.connectors.map((conn: any, index: number) => {
          const {
            name,
            vinculatedChannelName,
            paidStatus,
            connected: isConnected,
          } = conn.instance

          const isPaid = paidStatus === 'PAID' || paidStatus === 'TRIAL'

          const bgColor = isConnected ? '#DCFCE7' : '#FEE2E2'
          const statusColor = isConnected ? '#144A1B' : '#7A1818'
          const statusText = isConnected ? 'Ativo' : 'Inativo'
          const btnText = isConnected ? 'Desconectar' : 'Conectar'

          return (
            <div
              key={conn.id}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                index !== (session?.connectors.length ?? 0) - 1
                  ? 'border-b border-gray-100'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-black truncate">
                    {name || 'Sem nome'}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    {/* <span className="font-medium">
                      {formatPhoneNumber(phoneNumber)}
                    </span> */}
                    {/* <span className="text-gray-400">•</span> */}
                    <span className="truncate">
                      {vinculatedChannelName || 'Nenhum canal vinculado'}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex justify-center">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ color: statusColor, backgroundColor: bgColor }}
                  >
                    {statusText}
                  </span>
                </div>

                <div className="w-16 flex justify-end shrink-0 relative">
                  <button
                    onClick={() =>
                      setOpenMenuId(openMenuId === conn.id ? null : conn.id)
                    }
                    className="p-1.5 rounded-md border border-gray-200 hover:bg-[#d9fce6] transition-colors cursor-pointer"
                    title="Mais opções"
                  >
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {openMenuId === conn.id && (
                    <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-md w-40 py-0.5">
                      {(() => {
                        const menuItems = [
                          {
                            label: 'Editar',
                            onClick: () => {
                              abrirConfigurar(conn)
                            },
                          },
                          {
                            label: btnText,
                            onClick: async () => {
                              if (!isConnected) {
                                abrirConectar(conn)
                                await fetchQrCode(conn.id)
                              } else {
                                abrirDesconectar(conn)
                              }
                            },
                          },
                          {
                            label: !conn.instance?.vinculatedChannel
                              ? 'Vincular canal'
                              : 'Desvincular canal',
                            onClick: () => {
                              if (!conn.instance?.vinculatedChannel) {
                                abrirVincular(conn)
                              } else {
                                abrirDesvincular(conn)
                              }
                            },
                          },
                          // { label: 'Limpar fila', onClick: () => {} },
                          {
                            label: 'Cancelar conector',
                            onClick: () => {
                              setModalCancelarConector({
                                id: conn.id,
                                nome: conn.instance?.name || 'Sem nome',
                              })
                            },
                          },
                          // { label: 'Excluir', onClick: () => {} },
                        ]

                        return menuItems.map(item => (
                          <button
                            key={item.label}
                            disabled={!isPaid}
                            onClick={() => {
                              item.onClick()
                              setOpenMenuId(null)
                            }}
                            className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-black hover:bg-[#d9fce6] transition-colors ${
                              !isPaid
                                ? 'opacity-40 cursor-not-allowed'
                                : 'cursor-pointer'
                            } `}
                          >
                            {item.label}
                          </button>
                        ))
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <ConfigurarModal
        isOpen={configurarAberto}
        connector={connSelecionado}
        onClose={() => setConfigurarAberto(false)}
        onSave={(id: string, name: string) => {
          void handleSave(id, name)
        }}
      />

      <ConectarModal
        isOpen={conectarAberto}
        qrCode={qrCode}
        instanceId={connSelecionado?.instance?.instanceId ?? null}
        loading={qrLoading}
        onRefetch={() => {
          if (connSelecionado?.id) void fetchQrCode(connSelecionado.id)
        }}
        onClose={() => handleCloseConectar()}
      />

      <VincularCanalModal
        isOpen={vincularAberto}
        connector={connVincular}
        onClose={() => setVincularAberto(false)}
        onSuccess={async () => {
          await refreshSession()
          setVincularAberto(false)
        }}
      />

      <DesvincularCanalModal
        isOpen={desvincularAberto}
        connector={connDesvincular}
        onClose={() => setDesvincularAberto(false)}
        onSuccess={() => {
          void refreshSession()
          setDesvincularAberto(false)
        }}
      />

      <DesconectarModal
        isOpen={desconectarAberto}
        connector={connDesconectar}
        onClose={() => setDesconectarAberto(false)}
        onSuccess={() => {
          void refreshSession()
          setDesconectarAberto(false)
        }}
      />
      <CancelarConectorModal
        isOpen={modalCancelarConector != null}
        connector={modalCancelarConector}
        quantityAposCancelamento={quantityAposCancelamento}
        onClose={() => setModalCancelarConector(null)}
        onSuccess={() => {
          void refreshSession()
        }}
      />
    </div>
  )
}
