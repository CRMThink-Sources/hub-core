'use client'

import { useSession } from '@/providers/session-provider'
import { ConexaoPendenteBanner } from '../banners/conexao-pendente-banner'
import type { GoogleConnection } from '../types'

export default function ImportacoesLayout() {
  const { session } = useSession()
  const connection = session?.googleConnection as GoogleConnection | undefined
  const googlePendente = connection ? !connection.connected : false

  return (
    <div className="w-full flex flex-col pt-20 px-6 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between w-full max-w-3xl mx-auto bg-white p-6 rounded-xl border border-[#e5e7eb]">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Importações</h1>
          <h2 className="text-sm text-gray-400 mt-1">
            Área de trabalho de importações
          </h2>
        </div>
      </div>

      {/* banner de conexão pendente */}
      {googlePendente && (
        <ConexaoPendenteBanner
          message="Conexão com o Google pendente."
          ctaLabel="Conectar"
          href="/importsheet/configuracoes"
        />
      )}

      {/* conteúdo */}
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        <p className="text-sm text-gray-400 font-mono px-1">
          criar aqui a tela de importações
        </p>
      </div>
    </div>
  )
}
