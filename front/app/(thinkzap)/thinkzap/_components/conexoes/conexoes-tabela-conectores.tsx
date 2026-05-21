'use client'

import { useConnectors } from '@/app/hooks/use-connectors'
import { ConexaoRow } from './conexao-row'
import { useTranslation } from 'react-i18next'

type Connector = any

type ConnectorsControl = ReturnType<typeof useConnectors>

type Props = {
  conectores: Connector[] | undefined
  control: ConnectorsControl
  fetchQrCode: (connectorId: string) => Promise<void>
  onSolicitarCancelamento: (payload: { id: string; nome: string }) => void
}

export function ConexoesTabelaConectores({
  conectores,
  control,
  fetchQrCode,
  onSolicitarCancelamento,
}: Props) {
  const { t } = useTranslation('thinkzap/conexoes/tabela-conectores')
  const lista = conectores ?? []
  const ultimoIndice = lista.length - 1

  return (
    <div className="w-full overflow-visible rounded-lg border border-gray-100 bg-white">
      <div className="flex items-center justify-between gap-4 rounded-t-lg border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('colunas.nome')}
          </span>
        </div>
        <div className="flex flex-1 justify-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('colunas.status')}
          </span>
        </div>
        <div className="flex w-16 justify-end">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('colunas.acoes')}
          </span>
        </div>
      </div>

      {lista.map((conn, index) => (
        <ConexaoRow
          key={conn.id}
          conn={conn}
          showBorderBottom={index !== ultimoIndice}
          control={control}
          fetchQrCode={fetchQrCode}
          onSolicitarCancelamento={onSolicitarCancelamento}
        />
      ))}
    </div>
  )
}
