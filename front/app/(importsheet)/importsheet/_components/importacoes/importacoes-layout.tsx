'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon } from 'lucide-react'
import { useSession } from '@/providers/session-provider'
import { axiosImportsheet } from '@/infra/client/axios-importsheet'
import { LoadingProvider, useLoading } from '@/providers/loading-provider'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { Button } from '@/components/ui/button'
import { ConexaoPendenteBanner } from '../banners/conexao-pendente-banner'
import { NovaImportacaoModal } from './nova-importacao-modal'
import { ConfigurarImportacaoModal } from './configurar-importacao/configurar-importacao-modal'
import { ImportacoesLista } from './importacoes-lista'
import { ImportErrorModal } from './import-error-modal'
import { useImportForEdit } from './use-import-for-edit'
import { useImportsList } from './use-imports-list'
import type {
  GoogleConnection,
  ImportListItem,
  ImportSelection,
} from '../types'

export default function ImportacoesLayout() {
  return (
    <LoadingProvider>
      <LoadingOverlay />
      <ImportacoesContent />
    </LoadingProvider>
  )
}

function ImportacoesContent() {
  const { t } = useTranslation('importsheet/importacoes/layout')
  const { session, refreshSession } = useSession()
  const { setLoading } = useLoading()
  const connection = session?.googleConnection as GoogleConnection | undefined
  const googlePendente = connection ? !connection.connected : false
  const podeImportar = !!session && !googlePendente

  const seed = (session?.imports as ImportListItem[] | undefined) ?? []
  const { imports, refetch } = useImportsList(seed)

  const [modalOpen, setModalOpen] = useState(false)
  const [selection, setSelection] = useState<ImportSelection | null>(null)

  const [editId, setEditId] = useState<number | null>(null)
  const { data: editData } = useImportForEdit(editId)

  const [errorId, setErrorId] = useState<number | null>(null)

  function handleSaved() {
    setSelection(null)
    setEditId(null)
    // refetch atualiza a lista local na hora; refreshSession mantém o resto da sessão coerente.
    void refetch()
    void refreshSession()
  }

  async function handleDelete(id: number) {
    setLoading(true, t('excluindo'))
    try {
      await axiosImportsheet().delete(`/importsheet/imports/${id}`)
      await refetch()
      void refreshSession()
    } finally {
      setLoading(false)
    }
  }

  async function handleRun(id: number) {
    await axiosImportsheet().post(`/importsheet/imports/${id}/run`)
    // Enfileira async — o polling reflete o status; aqui só adianta um ciclo.
    await refetch()
  }

  async function handleToggleEnabled(id: number, enabled: boolean) {
    await axiosImportsheet().patch(`/importsheet/imports/${id}/enabled`, {
      enabled,
    })
    await refetch()
  }

  function handleSelect(next: ImportSelection) {
    setSelection(next)
    setModalOpen(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t('titulo')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitulo')}</p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          disabled={!podeImportar}
          title={googlePendente ? t('conecteGoogle') : undefined}
        >
          <PlusIcon />
          {t('novaImportacao')}
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
          onSaved={handleSaved}
          onBack={() => {
            setSelection(null)
            setModalOpen(true)
          }}
        />
      )}

      {editData && (
        <ConfigurarImportacaoModal
          open
          selection={editData.selection}
          initial={editData.initial}
          onClose={() => setEditId(null)}
          onSaved={handleSaved}
          onBack={() => setEditId(null)}
        />
      )}

      {errorId !== null && (
        <ImportErrorModal
          importId={errorId}
          onClose={() => setErrorId(null)}
          onResolved={() => void refetch()}
        />
      )}

      {googlePendente && (
        <ConexaoPendenteBanner
          message={t('conexaoPendente')}
          ctaLabel={t('conectar')}
          href="/importsheet/configuracoes"
        />
      )}

      {!session ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">{t('carregando')}</p>
        </div>
      ) : podeImportar && imports.length > 0 ? (
        <ImportacoesLista
          imports={imports}
          onEdit={setEditId}
          onDelete={handleDelete}
          onRun={handleRun}
          onToggleEnabled={handleToggleEnabled}
          onShowErrors={setErrorId}
        />
      ) : podeImportar ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t('vazioAntes')}{' '}
            <span className="font-medium text-foreground">
              {t('novaImportacao')}
            </span>{' '}
            {t('vazioDepois')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
