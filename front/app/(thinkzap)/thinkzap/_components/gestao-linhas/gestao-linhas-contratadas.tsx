'use client'

type Connector = {
  id: string
  instance: {
    name?: string | null
    phoneNumber?: string | null
    status?: string | null
  }
}

type Props = {
  connectors: Connector[]
  totalLinhas: number
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
    default:
      return {
        bgColor: '#FEE2E2',
        textColor: '#7A1818',
        text: 'Inativo',
      }
  }
}

export function GestaoLinhasContratadas({ connectors, totalLinhas }: Props) {
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">
            Linhas contratadas
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-4 items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase text-gray-600">
              Telefone
            </p>
            <p className="text-xs font-semibold uppercase text-gray-600">
              Nome do canal
            </p>
            <p className="text-end text-xs font-semibold uppercase text-gray-600">
              Conexão
            </p>
          </div>

          {connectors.map(conn => {
            const status = getConnectionStatus(conn.instance.status)
            return (
              <div
                key={conn.id}
                className="grid grid-cols-4 items-center gap-4 rounded-lg border border-gray-100 bg-white p-3 transition-colors hover:border-gray-200"
              >
                <p className="text-sm font-medium text-black">
                  {formatPhoneNumber(conn.instance.phoneNumber ?? '')}
                </p>
                <p className="text-sm font-semibold text-black">
                  {conn.instance.name || 'Sem nome'}
                </p>
                <div className="flex justify-end">
                  <span
                    className="rounded-md px-2 py-1 text-xs font-medium"
                    style={{
                      color: status.textColor,
                      backgroundColor: status.bgColor,
                    }}
                  >
                    {status.text}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <h3 className="inline-flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#F5F5F5] px-3 py-1.5 text-sm font-medium text-[#6B7280]">
        Total de linhas: {totalLinhas}
      </h3>
    </>
  )
}
