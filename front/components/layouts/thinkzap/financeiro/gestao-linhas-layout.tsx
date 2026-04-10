'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/providers/session-provider'

const jsonValorLinha = {
  valor: [
    {
      valorLinha: '337.0',
    },
  ],
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const formatPhoneNumber = (phone: string) => {
  if (!phone) return '-'
  const match = phone.match(/^\+(\d{2})(\d{2})(\d{5})(\d{4})$/)
  if (!match) return phone
  return `+${match[1]} ${match[2]} ${match[3]}-${match[4]}`
}

export default function GestaoLinhas() {
  const { session } = useSession()
  const router = useRouter()

  const [quantidade, setQuantidade] = useState(1)

  const totalLinhas = session?.connectors.length ?? 0

  const valorPorLinha = parseFloat(jsonValorLinha.valor[0].valorLinha)
  const desconto = quantidade > 1 ? (quantidade - 1) * 50 : 0
  const totalFinal = valorPorLinha * quantidade - desconto

  const handleIncrement = () => setQuantidade(prev => prev + 1)
  const handleDecrement = () => setQuantidade(prev => (prev > 0 ? prev - 1 : 0))

  // func para chamar o stripe com a quantidade de conectores selecionados.
  function handleBuy() {
    if (quantidade < 1) return // talvez adicionar um toast aqui para informar que precisa de pelo menos uma linha para prosseguir para o Stripe.
    router.push(`/checkout?quantity=${quantidade}`)
  }

  return (
    <div className="space-y-8">
      <div className="border-t border-gray-200"></div>

      <div className="space-y-4 bg-gray-50 p-5 rounded-lg border border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-black">
            Contratar novas linhas
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Aumente sua capacidade contratando mais linhas.
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDecrement}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 font-semibold border border-gray-200 cursor-pointer"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-black min-w-[40px] text-center">
                  {quantidade}
                </span>
                <button
                  onClick={handleIncrement}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 font-semibold border border-gray-200 cursor-pointer"
                >
                  +
                </button>
              </div>

              <div className="text-left">
                <p className="text-sm text-gray-600">Valor por linha</p>
                <p className="text-lg font-semibold text-black">
                  R$ {formatCurrency(totalFinal)}
                </p>

                {desconto > 0 && (
                  <p className="text-xs text-green-600">
                    Desconto de R${formatCurrency(desconto)} aplicado.
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleBuy}
              className="px-5 py-2 text-sm font-medium bg-[#5A997E] text-white rounded-md hover:bg-[#4a8169] transition-colors cursor-pointer"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">
            Linhas contratadas
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-4 items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase">
              Telefone
            </p>
            <p className="text-xs font-semibold text-gray-600 uppercase">
              Nome do canal
            </p>

            <p className="text-xs font-semibold text-gray-600 uppercase text-end">
              Conexão
            </p>
          </div>

          {session?.connectors.map((conn: any) => {
            const { name, phoneNumber, status, paidStatus } = conn.instance

            let connectionBgColor = ''
            let connectionStatusColor = ''
            let connectionStatusText = ''
            switch (status) {
              case 'ACTIVE':
                connectionBgColor = '#DCFCE7'
                connectionStatusColor = '#144A1B'
                connectionStatusText = 'Ativo'
                break
              case 'PENDING_SETUP':
                connectionBgColor = '#FEF9C3'
                connectionStatusColor = '#854D0E'
                connectionStatusText = 'Configuração pendente'
                break
              default:
                connectionBgColor = '#FEE2E2'
                connectionStatusColor = '#7A1818'
                connectionStatusText = 'Inativo'
                break
            }

            return (
              <div
                key={conn.id}
                className="grid grid-cols-4 gap-4 items-center bg-white p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <p className="text-black font-medium text-sm">
                  {formatPhoneNumber(phoneNumber)}
                </p>
                <p className="text-black font-semibold text-sm">
                  {name || 'Sem nome'}
                </p>

                <div className="flex justify-end">
                  <span
                    className="text-xs font-medium px-2 py-1 rounded-md"
                    style={{
                      color: connectionStatusColor,
                      backgroundColor: connectionBgColor,
                    }}
                  >
                    {connectionStatusText}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <h3 className="inline-flex items-center gap-2 bg-[#F5F5F5] text-[#6B7280] px-3 py-1.5 rounded-md border border-[#E5E7EB] text-sm font-medium">
        Total de linhas: {totalLinhas}
      </h3>
    </div>
  )
}
