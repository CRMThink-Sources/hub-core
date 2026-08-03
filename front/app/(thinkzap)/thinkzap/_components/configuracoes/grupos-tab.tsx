'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useListGroups } from '@/app/hooks/use-list-groups'
import { useGroupMutations } from '@/app/hooks/use-group-mutations'
import { ConfirmModal } from './confirm-modal'
import { CriarGrupoTab } from './criar-grupo-tab'
import { GrupoDetalhePanel } from './grupo-detalhe-panel'
import { GruposLista } from './grupos-lista'

type View = 'lista' | 'criar' | 'detalhe'

type Props = {
  itemId: string
  isConnected: boolean
}

export function GruposTab({ itemId, isConnected }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/grupos')
  const [view, setView] = useState<View>('lista')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<{
    groupId: string
    groupName: string
  } | null>(null)

  const { groups, loading, error, page, hasNextPage, fetchGroups } =
    useListGroups()
  const {
    leaveGroup,
    loading: leaving,
    error: leaveError,
  } = useGroupMutations()

  const loadList = useCallback(
    (targetPage = page) => {
      void fetchGroups(itemId, targetPage)
    },
    [itemId, fetchGroups, page],
  )

  useEffect(() => {
    if (view === 'lista' && isConnected) {
      void fetchGroups(itemId, 1)
    }
  }, [view, isConnected, itemId, fetchGroups])

  const handleLeaveFromList = async () => {
    if (!leaveTarget) return
    const ok = await leaveGroup({
      itemId,
      groupId: leaveTarget.groupId,
    })
    if (ok) {
      setLeaveTarget(null)
      loadList(page)
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('desconectado')}
      </div>
    )
  }

  if (view === 'criar') {
    return (
      <CriarGrupoTab
        itemId={itemId}
        isConnected={isConnected}
        onBack={() => {
          setView('lista')
          loadList(1)
        }}
        onViewList={() => {
          setView('lista')
          loadList(1)
        }}
      />
    )
  }

  if (view === 'detalhe' && selectedGroupId) {
    return (
      <GrupoDetalhePanel
        itemId={itemId}
        groupId={selectedGroupId}
        onBack={() => {
          setSelectedGroupId(null)
          setView('lista')
          loadList(page)
        }}
        onLeftGroup={() => {
          setSelectedGroupId(null)
          setView('lista')
          loadList(1)
        }}
      />
    )
  }

  return (
    <>
      <GruposLista
        groups={groups}
        loading={loading}
        error={error ?? leaveError}
        page={page}
        hasNextPage={hasNextPage}
        onEdit={groupId => {
          setSelectedGroupId(groupId)
          setView('detalhe')
        }}
        onLeave={(groupId, groupName) => setLeaveTarget({ groupId, groupName })}
        onCreateNew={() => setView('criar')}
        onPrevPage={() => {
          if (page > 1) void fetchGroups(itemId, page - 1)
        }}
        onNextPage={() => {
          if (hasNextPage) void fetchGroups(itemId, page + 1)
        }}
        labels={{
          titulo: t('lista.titulo'),
          novoGrupo: t('lista.novoGrupo'),
          colunaNome: t('lista.colunaNome'),
          colunaUltimaMsg: t('lista.colunaUltimaMsg'),
          colunaAcoes: t('lista.colunaAcoes'),
          editar: t('lista.editar'),
          sair: t('lista.sair'),
          vazio: t('lista.vazio'),
          carregando: t('lista.carregando'),
          anterior: t('lista.anterior'),
          proxima: t('lista.proxima'),
          pagina: t('lista.pagina'),
        }}
      />

      <ConfirmModal
        isOpen={!!leaveTarget}
        title={t('modal.sairTitulo')}
        message={t('modal.sairMensagem')}
        confirmLabel={leaving ? t('modal.saindo') : t('modal.confirmar')}
        cancelLabel={t('modal.cancelar')}
        loading={leaving}
        onConfirm={() => void handleLeaveFromList()}
        onClose={() => setLeaveTarget(null)}
      />
    </>
  )
}
