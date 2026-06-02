'use client'

import { useState } from 'react'
import { useSession } from '@/providers/session-provider'
import { ConexaoPendenteBanner } from '../banners/conexao-pendente-banner'
import { NovaImportacaoModal } from './nova-importacao-modal'
import type { GoogleConnection, ImportSelection } from '../types'

export default function ImportacoesLayout() {
  const { session } = useSession()
  const connection = session?.googleConnection as GoogleConnection | undefined
  const googlePendente = connection ? !connection.connected : false
  // Enquanto a sessão não carrega, não dá pra saber se há conexão — mantém desabilitado.
  const podeImportar = !!session && !googlePendente

  const [modalOpen, setModalOpen] = useState(false)

  function handleSelect(selection: ImportSelection) {
    // TODO(etapa 2): iniciar o de-para de colunas da aba selecionada.
    console.log('seleção', selection)
    setModalOpen(false)
  }

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
        <button
          onClick={() => setModalOpen(true)}
          disabled={!podeImportar}
          title={
            googlePendente ? 'Conecte uma conta Google primeiro' : undefined
          }
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#e5e7eb] bg-white text-gray-900
                   hover:bg-gray-50 hover:border-gray-900 transition-all cursor-pointer whitespace-nowrap
                   disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Nova importação
        </button>
      </div>

      <NovaImportacaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
      />

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
