'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { useSession } from '@/providers/session-provider'
import { Button } from '@/components/ui/button'
import { ConexaoPendenteBanner } from '../banners/conexao-pendente-banner'
import { NovaImportacaoModal } from './nova-importacao-modal'
import { ConfigurarImportacaoModal } from './configurar-importacao/configurar-importacao-modal'
import type { GoogleConnection, ImportSelection } from '../types'

export default function ImportacoesLayout() {
  const { session } = useSession()
  const connection = session?.googleConnection as GoogleConnection | undefined
  const googlePendente = connection ? !connection.connected : false
  const podeImportar = !!session && !googlePendente

  const [modalOpen, setModalOpen] = useState(false)
  const [selection, setSelection] = useState<ImportSelection | null>(null)

  function handleSelect(next: ImportSelection) {
    setSelection(next)
    setModalOpen(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 pt-20">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Importações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Área de trabalho de importações
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          disabled={!podeImportar}
          title={
            googlePendente ? 'Conecte uma conta Google primeiro' : undefined
          }
        >
          <PlusIcon />
          Nova importação
        </Button>
      </div>

      <NovaImportacaoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
      />

      {selection && (
        <ConfigurarImportacaoModal
          open={selection !== null}
          selection={selection}
          onClose={() => setSelection(null)}
          onBack={() => {
            setSelection(null)
            setModalOpen(true)
          }}
        />
      )}

      {googlePendente && (
        <ConexaoPendenteBanner
          message="Conexão com o Google pendente."
          ctaLabel="Conectar"
          href="/importsheet/configuracoes"
        />
      )}

      {!session ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      ) : podeImportar ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma importação ainda. Clique em{' '}
            <span className="font-medium text-foreground">Nova importação</span>{' '}
            para começar.
          </p>
        </div>
      ) : null}
    </div>
  )
}
