'use client'

import { useState } from 'react'
import { useSession } from '@/providers/session-provider'
import { ConectarModal } from '../_components/conectar-modal'
import { useQrCode } from '@/app/hooks/use-qr-code'
import { useConnectors } from '@/app/hooks/use-connectors'
import { VincularCanalModal } from '../_components/vincular-canal-modal'
import { DesvincularCanalModal } from '../_components/desvincular-canal-modal'
import { DesconectarModal } from '../_components/desconectar-modal'
import { CancelarConectorModal } from '../_components/cancelar-conector-modal'
import { useConnectorsSocket } from '@/app/hooks/use-connectors-socket'
import { THINKZAP_TRIAL_MAX_CONNECTORS } from '@/shared/constants/thinkzap-trial'
import { ConexoesHeaderCard } from '../_components/conexoes/conexoes-header-card'
import { ConexoesResumoConectados } from '../_components/conexoes/conexoes-resumo-conectados'
import { ConexoesTabelaConectores } from '../_components/conexoes/conexoes-tabela-conectores'

export default function ConexoesLayout() {
  const { session, refreshSession } = useSession()
  const { qrCode, loading: qrLoading, fetchQrCode } = useQrCode()
  const [modalCancelarConector, setModalCancelarConector] = useState<{
    id: string
    nome: string
  } | null>(null)

  const connectors = useConnectors()

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

  const handleCloseConectar = () => {
    connectors.connect.close()
    void refreshSession()
  }

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 pb-10 pt-8 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 rounded-lg border border-gray-100 bg-white p-6">
        <ConexoesHeaderCard
          hasSubscription={Boolean(subscription)}
          subscriptionStatus={subscription?.status}
        />
      </div>

      <ConexoesResumoConectados connected={connected} total={total} />

      <ConexoesTabelaConectores
        conectores={session?.connectors}
        control={connectors}
        fetchQrCode={fetchQrCode}
        onSolicitarCancelamento={payload =>
          setModalCancelarConector({
            id: payload.id,
            nome: payload.nome,
          })
        }
      />

      <ConectarModal
        isOpen={connectors.connect.isOpen}
        qrCode={qrCode}
        instanceId={connectors.connect.connector?.instance?.instanceId ?? null}
        loading={qrLoading}
        onRefetch={() => {
          const id = connectors.connect.connector?.id
          if (id) void fetchQrCode(id)
        }}
        onClose={() => handleCloseConectar()}
      />

      <VincularCanalModal
        isOpen={connectors.linkChannel.isOpen}
        connector={connectors.linkChannel.connector}
        onClose={connectors.linkChannel.close}
        onSuccess={async () => {
          await refreshSession()
          connectors.linkChannel.close()
        }}
      />

      <DesvincularCanalModal
        isOpen={connectors.unlinkChannel.isOpen}
        connector={connectors.unlinkChannel.connector}
        onClose={connectors.unlinkChannel.close}
        onSuccess={() => {
          void refreshSession()
          connectors.unlinkChannel.close()
        }}
      />

      <DesconectarModal
        isOpen={connectors.disconnect.isOpen}
        connector={connectors.disconnect.connector}
        onClose={connectors.disconnect.close}
        onSuccess={() => {
          void refreshSession()
          connectors.disconnect.close()
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
