'use client'

type Connector = {
  id: string
  instance: {
    name?: string | null
    phoneNumber?: string | null
    paidStatus?: string | null
  }
}

type Props = {
  connectors: Connector[]
  totalLinhas: number
  isTrial: boolean
  submitting: boolean
  onConfirmTrial: () => void
}

function formatPhoneNumber(phone: string) {
  if (!phone) return '-'
  const match = phone.match(/^\+(\d{2})(\d{2})(\d{5})(\d{4})$/)
  if (!match) return phone
  return `+${match[1]} ${match[2]} ${match[3]}-${match[4]}`
}

function getConnectionStatus(status?: string | null) {
  switch (status) {
    case 'ACTIVE':
      return {
        bgColor: '#DCFCE7',
        textColor: '#144A1B',
        text: 'Ativo',
      }
    case 'PENDING_SETUP':
      return {
        bgColor: '#FEF9C3',
        textColor: '#854D0E',
        text: 'Configuração pendente',
      }
    case 'TRIAL':
      return {
        bgColor: '#FEF9C3',
        textColor: '#854D0E',
        text: 'Trial',
      }
    default:
      return {
        bgColor: '#FEE2E2',
        textColor: '#7A1818',
        text: 'Inativo',
      }
  }
}

export function GestaoLinhasContratadas({
  connectors,
  totalLinhas,
  isTrial,
  submitting,
  onConfirmTrial,
}: Props) {
  /** Três colunas no header e nas linhas; status + ação ficam na mesma célula "Conexão". */
  const gridClass =
    'grid-cols-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(11rem,auto)] sm:items-center sm:gap-x-4 sm:gap-y-0'

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">
            Linhas contratadas
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          <table>
            <thead className="bg-gray-50 text-left">
              <tr className="text-xs font-semibold uppercase text-gray-600 h-10">
                <th className="min-w-40 px-3 py-2">Telefone</th>
                <th className="px-3 py-2">Nome do canal</th>
                <th className="px-3 py-2 min-w-40">Conexão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {connectors.map(conn => {
                const status = getConnectionStatus(conn.instance.paidStatus)
                const showEfetivar =
                  isTrial && conn.instance.paidStatus === 'TRIAL'
                return (
                  <tr key={conn.id}>
                    <td className="px-3 py-2">
                      {formatPhoneNumber(conn.instance.phoneNumber ?? '')}
                    </td>
                    <td className="px-3 py-2">
                      {conn.instance.name || 'Sem nome'}
                    </td>
                    <td className="flex items-center justify-between px-3 py-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${status.textColor} ${status.bgColor}`}
                      >
                        {status.text}
                      </span>
                      {showEfetivar ? (
                        <button
                          type="button"
                          onClick={onConfirmTrial}
                          disabled={submitting}
                          className="shrink-0 cursor-pointer rounded-md bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                        >
                          Efetivar assinatura
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* <div
            className={`grid items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 ${gridClass}`}
          >
            <p className="text-xs font-semibold uppercase text-gray-600">
              Telefone
            </p>
            <p className="text-xs font-semibold uppercase text-gray-600 sm:min-w-0">
              Nome do canal
            </p>
            <p className="text-start text-xs font-semibold uppercase text-gray-600 sm:text-end">
              Conexão
            </p>
          </div> */}

          {/* {connectors.map(conn => {
            const status = getConnectionStatus(conn.instance.paidStatus)
            const showEfetivar = isTrial && conn.instance.paidStatus === 'TRIAL'

            return (
              <div
                key={conn.id}
                className={`grid items-center gap-4 rounded-lg border border-gray-100 bg-white p-3 transition-colors hover:border-gray-200 ${gridClass}`}
              >
                <p className="text-sm font-medium text-black">
                  {formatPhoneNumber(conn.instance.phoneNumber ?? '')}
                </p>
                <p className="min-w-0 break-all text-sm font-semibold text-black sm:wrap-break-word">
                  {conn.instance.name || 'Sem nome'}
                </p>
                <div className="flex flex-wrap items-center justify-start gap-2 sm:min-w-0 sm:justify-end sm:gap-2.5">
                  <span
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
                    style={{
                      color: status.textColor,
                      backgroundColor: status.bgColor,
                    }}
                  >
                    {status.text}
                  </span>
                  {showEfetivar ? (
                    <button
                      type="button"
                      onClick={onConfirmTrial}
                      disabled={submitting}
                      className="shrink-0 cursor-pointer rounded-md bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm"
                    >
                      Efetivar assinatura
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })} */}
        </div>
      </div>

      <h3 className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#F5F5F5] px-3 py-1.5 text-sm font-medium text-[#6B7280]">
        Total de linhas: {totalLinhas}
      </h3>
    </>
  )
}
