'use client'

import { ConectarModal } from '@/components/modals/conectar-modal'
import { ConfigurarModal } from '@/components/modals/configurar-modal'
import { useSession } from '@/providers/session-provider'
import Link from 'next/link'
import { useState } from 'react'

const jsonRetorno = {
  connectors: [
    {
      id: 'c1a2b3d4',
      instance: {
        name: 'Celular comercial - Fulano',
        vinculatedChannel: 'Canal Comercial - Vendas',
        phoneNumber: '+5511999990001',
        status: 'CONNECTED',
        paidStatus: 'paid',
      },
    },
    {
      id: 'c5e6f7g8',
      instance: {
        name: 'Celular suporte - Ciclano',
        vinculatedChannel: 'Canal suporte - Atendimento inicial',
        phoneNumber: '+5511988880002',
        status: 'DISCONNECTED',
        paidStatus: 'paid',
      },
    },
    {
      id: 'c9h0i1j2',
      instance: {
        name: 'Canal comercial - Beltrano',
        vinculatedChannel: null,
        phoneNumber: '+5511977770003',
        status: null,
        paidStatus: 'canceled',
      },
    },
  ],
}

const jsonQrCode = {
  qrCode:
    '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',
}

const formatPhoneNumber = (phone: string) => {
  if (!phone) return '-'
  const match = phone.match(/^\+(\d{2})(\d{2})(\d{5})(\d{4})$/)
  if (!match) return phone
  return `+${match[1]} ${match[2]} ${match[3]}-${match[4]}`
}

export default function ConexoesLayout() {
  const { session } = useSession()
  const [qrCode, setQrCode] = useState<string | null>(null)

  const [configurarAberto, setConfigurarAberto] = useState(false)
  const [conectarAberto, setConectarAberto] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const [connSelecionado, setConnSelecionado] = useState<
    (typeof jsonRetorno.connectors)[0] | null
  >(null)

  const handleSave = (id: string) => {
    console.log('salvar para o id:', id)
    setConfigurarAberto(false)
    setConectarAberto(false)
  }

  const total = jsonRetorno.connectors.length
  const connected = jsonRetorno.connectors.filter(
    c => c.instance.status === 'CONNECTED',
  ).length

  return (
    <div className="w-full flex flex-col pt-20 px-6 space-y-6">
      <div className="flex items-center justify-between w-full max-w-5xl bg-white p-6 rounded-lg border border-gray-100">
        <div>
          <h1 className="page-title">Configurações</h1>
          <h2 className="page-subtitle mt-1">
            Gerencie os números de WhatsApp conectados ao Bitrix24
          </h2>
        </div>

        <Link
          className="bg-[#5A997E] text-white font-medium py-2.5 px-5 rounded-lg hover:bg-[#4a8169] transition-colors cursor-pointer"
          href="/bitrix/pagamentos"
        >
          {' '}
          + Contratar linha
        </Link>
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
          const { name, vinculatedChannel, phoneNumber, status, paidStatus } =
            conn.instance

          const isPaid = paidStatus === 'paid'

          let bgColor = ''
          let statusColor = ''
          let statusText = ''
          let btnText = ''

          switch (paidStatus) {
            case 'paid':
              switch (status) {
                case 'CONNECTED':
                  bgColor = '#DCFCE7'
                  statusColor = '#144A1B'
                  statusText = 'Ativo'
                  btnText = 'Desconectar'
                  break
                default:
                  bgColor = '#FEE2E2'
                  statusColor = '#7A1818'
                  statusText = 'Inativo'
                  btnText = 'Conectar'
                  break
              }
              break
            case 'canceled':
              bgColor = '#FEE2E2'
              statusColor = '#7A1818'
              statusText = 'Cancelado'
              btnText = 'Conectar'
              break
            default:
              bgColor = '#F3F4F6'
              statusColor = '#6B7280'
              statusText = '-'
              btnText = 'Conectar'
              break
          }

          return (
            <div
              key={conn.id}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                index !== jsonRetorno.connectors.length - 1
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
                    <span className="font-medium">
                      {formatPhoneNumber(phoneNumber)}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="truncate">
                      {vinculatedChannel || 'Nenhum canal vinculado'}
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
                              setConnSelecionado(conn)
                              setConfigurarAberto(true)
                            },
                          },
                          {
                            label: btnText,
                            onClick: () => {
                              if (btnText === 'Conectar') {
                                setConnSelecionado(conn)
                                setQrCode(jsonQrCode.qrCode)
                                setConectarAberto(true)
                              } else {
                                console.log('desconectar id:', conn.id)
                              }
                            },
                          },
                          { label: 'Vincular canal', onClick: () => {} },
                          { label: 'Limpar fila', onClick: () => {} },
                          { label: 'Cancelar assinatura', onClick: () => {} },
                          { label: 'Excluir', onClick: () => {} },
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
                            }`}
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
        onSave={handleSave}
      />

      <ConectarModal
        isOpen={conectarAberto}
        qrCode={qrCode}
        onClose={() => setConectarAberto(false)}
        onSave={handleSave}
      />
    </div>
  )
}
