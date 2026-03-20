/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
'use client'

import { useState } from 'react'

const jsonRetorno = {
  success: true,
  lines: [
    {
      lineId: 'linha_001',
      phone: '5511991111111',
      status: 'PAID',
      plan: 'Mensal',
      price: '130.00',
      paidAt: '2026-02-01T09:10:00Z',
      expiresAt: '2026-03-01T09:10:00Z',
    },
    {
      lineId: 'linha_002',
      phone: '5511992222222',
      status: 'PAID',
      plan: 'Mensal',
      price: '130.00',
      paidAt: '2026-02-02T10:30:00Z',
      expiresAt: '2026-03-02T10:30:00Z',
    },
    {
      lineId: 'linha_003',
      phone: '5511993333333',
      status: 'PAID',
      plan: 'Mensal',
      price: '130.00',
      paidAt: '2026-02-03T14:45:20Z',
      expiresAt: '2026-03-03T14:45:20Z',
    },
    {
      lineId: 'linha_004',
      phone: '5511994444444',
      status: 'waitting_payment',
      plan: 'anual',
      price: '130.00',
      paidAt: '2026-02-04T18:00:00Z',
      expiresAt: '2026-03-04T18:00:00Z',
    },
    {
      lineId: 'linha_005',
      phone: '5511995555555',
      status: 'CANCELED',
      plan: 'Mensal',
      price: '130.00',
      canceledAt: '2026-02-05T12:20:10Z',
      reason: 'Pagamento não confirmado',
    },
  ],
}

const formatPhoneNumber = (phone: string) => {
  if (!phone) return '-'
  const match = phone.match(/^(\d{2})(\d{2})(\d{5})(\d{4})$/)
  if (!match) return phone
  return `+${match[1]} ${match[2]} ${match[3]}-${match[4]}`
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function HistoricoPagamentos() {
  const [filtroTipo, setFiltroTipo] = useState('mes_atual')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const handleFiltrar = () => {
    console.log('Filtrando por:', filtroTipo, dataInicio, dataFim)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div className="flex-1 max-w-xs">
          <label className="text-sm text-gray-600 mb-1 block">Período</label>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="w-full px-3 py-2 text-sm text-black bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5A997E] focus:border-transparent"
          >
            <option value="hoje">Hoje</option>
            <option value="semana_atual">Semana atual</option>
            <option value="mes_atual">Mês atual</option>
            <option value="customizado">Customizado</option>
          </select>
        </div>
        {filtroTipo === 'customizado' && (
          <>
            <div className="flex-1 max-w-[200px]">
              <label className="text-sm text-gray-600 mb-1 block">
                Data início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 text-sm text-black bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5A997E] focus:border-transparent"
              />
            </div>

            <div className="flex-1 max-w-[200px]">
              <label className="text-sm text-gray-600 mb-1 block">
                Data fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="w-full px-3 py-2 text-sm text-black bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#5A997E] focus:border-transparent"
              />
            </div>
          </>
        )}
        <button
          onClick={handleFiltrar}
          className="px-5 py-2 text-sm font-medium bg-[#5A997E] text-white rounded-md hover:bg-[#4a8169] transition-colors"
        >
          Filtrar
        </button>
      </div>
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                  Data
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                  Descrição
                </th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {jsonRetorno.lines.map(line => {
                const date =
                  line.status === 'PAID' || line.status === 'waitting_payment'
                    ? line.paidAt || '-'
                    : line.canceledAt || '-'

                const { phone, status } = line

                let bgColor = ''
                let statusColor = ''
                let statusText = ''

                switch (status) {
                  case 'PAID':
                    statusText = 'Pago'
                    statusColor = '#166534'
                    bgColor = '#DCFCE7'
                    break
                  case 'waitting_payment':
                    statusText = 'Pendente'
                    statusColor = '#78350F'
                    bgColor = '#FEF3C7'
                    break
                  default:
                    statusText = 'Cancelado'
                    statusColor = '#7A1818'
                    bgColor = '#FEE2E2'
                    break
                }

                return (
                  <tr
                    key={line.lineId}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-black">
                      {date !== '-' ? formatDate(date) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-black">
                      {formatPhoneNumber(phone)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md"
                        style={{ color: statusColor, backgroundColor: bgColor }}
                      >
                        {statusText}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
