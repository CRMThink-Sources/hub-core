'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGroupMetadata } from '@/app/hooks/use-group-metadata'
import { useGroupMutations } from '@/app/hooks/use-group-mutations'
import type { BitrixContact } from '@/app/hooks/use-bitrix-contacts'
import { ConfirmModal } from './confirm-modal'
import { GrupoAvatar } from './grupo-avatar'
import { GrupoFotoUpload } from './grupo-foto-upload'
import { ParticipantesPicker } from './participantes-picker'

type Props = {
  connectorId: string
  groupId: string
  authTokenKey: string
  onBack: () => void
  onLeftGroup: () => void
}

export function GrupoDetalhePanel({
  connectorId,
  groupId,
  authTokenKey,
  onBack,
  onLeftGroup,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/grupos')
  const { metadata, loading, error, fetchMetadata, setError } =
    useGroupMetadata(authTokenKey)
  const mutations = useGroupMutations(authTokenKey)

  const [groupName, setGroupName] = useState('')
  const [description, setDescription] = useState('')
  const [autoInvite, setAutoInvite] = useState(true)
  const [pendingPhones, setPendingPhones] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [removeModal, setRemoveModal] = useState<{
    phone: string
  } | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)

  useEffect(() => {
    void fetchMetadata(connectorId, groupId)
  }, [connectorId, groupId, fetchMetadata])

  useEffect(() => {
    if (metadata) {
      setGroupName(metadata.subject)
      setDescription(metadata.description ?? '')
    }
  }, [metadata])

  const displayError = error ?? sectionError ?? mutations.error

  const handleCopyLink = async () => {
    if (!metadata?.invitationLink) return
    try {
      await navigator.clipboard.writeText(metadata.invitationLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setSectionError(t('detalhe.semLink'))
    }
  }

  const handleSaveName = async () => {
    setSectionError(null)
    const ok = await mutations.updateName({
      connectorId,
      groupId,
      groupName: groupName.trim(),
    })
    if (ok) void fetchMetadata(connectorId, groupId)
  }

  const handleSaveDescription = async () => {
    setSectionError(null)
    const ok = await mutations.updateDescription({
      connectorId,
      groupId,
      groupDescription: description,
    })
    if (ok) void fetchMetadata(connectorId, groupId)
  }

  const handlePhotoFile = (file: File) => {
    setSectionError(null)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      const ok = await mutations.updatePhoto({
        connectorId,
        groupId,
        groupPhoto: base64,
      })
      if (ok) void fetchMetadata(connectorId, groupId)
    }
    reader.readAsDataURL(file)
  }

  const addPendingParticipant = (phone: string, _contact?: BitrixContact) => {
    const normalized = phone.replace(/\D/g, '')
    if (pendingPhones.some(p => p.replace(/\D/g, '') === normalized)) {
      setSectionError(t('picker.telefoneJaAdicionado'))
      return false
    }
    setPendingPhones(prev => [...prev, phone])
    setSectionError(null)
    return true
  }

  const handleConfirmAddParticipants = async () => {
    if (pendingPhones.length === 0) return
    setSectionError(null)
    const ok = await mutations.addParticipants({
      connectorId,
      groupId,
      autoInvite,
      phones: pendingPhones,
    })
    if (ok) {
      setPendingPhones([])
      void fetchMetadata(connectorId, groupId)
    }
  }

  const handleRemoveParticipant = async (phone: string) => {
    setSectionError(null)
    const ok = await mutations.removeParticipants({
      connectorId,
      groupId,
      phones: [phone],
    })
    if (ok) {
      setRemoveModal(null)
      void fetchMetadata(connectorId, groupId)
    }
  }

  const handleLeave = async () => {
    const ok = await mutations.leaveGroup({ connectorId, groupId })
    if (ok) {
      setLeaveModalOpen(false)
      onLeftGroup()
    }
  }

  if (loading && !metadata) {
    return <p className="text-sm text-gray-500">{t('detalhe.carregando')}</p>
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="w-fit cursor-pointer text-sm text-[#5A997E] hover:underline"
      >
        ← {t('detalhe.voltar')}
      </button>

      {displayError && <p className="text-sm text-red-600">{displayError}</p>}

      {metadata && (
        <div className="flex items-center gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <GrupoAvatar
            src={metadata.photoUrl}
            label={metadata.subject || metadata.phone}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-black">
              {metadata.subject || metadata.phone}
            </h3>
            <p className="text-xs text-gray-500">{metadata.phone}</p>
            <p className="mt-1 text-sm text-gray-600">
              {t('detalhe.totalParticipantes', {
                count: metadata.participants?.length ?? 0,
              })}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-black">
          {t('detalhe.nome')}
        </label>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void handleSaveName()}
            disabled={mutations.loading}
            className="shrink-0 cursor-pointer rounded-md bg-[#5A997E] px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {mutations.loading
              ? t('detalhe.salvando')
              : t('detalhe.salvarNome')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-black">
          {t('detalhe.descricao')}
        </label>
        <textarea
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void handleSaveDescription()}
          disabled={mutations.loading}
          className="w-fit cursor-pointer rounded-md bg-[#5A997E] px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {mutations.loading
            ? t('detalhe.salvando')
            : t('detalhe.salvarDescricao')}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-black">
          {t('detalhe.foto')}
        </label>
        <GrupoFotoUpload
          currentPhotoUrl={metadata?.photoUrl}
          label={metadata?.subject ?? groupId}
          uploading={mutations.loading}
          onFileSelect={handlePhotoFile}
          onError={setSectionError}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-black">
          {t('detalhe.linkConvite')}
        </label>
        {metadata?.invitationLink ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={metadata.invitationLink}
              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="shrink-0 cursor-pointer rounded-md bg-[#5A997E] px-3 py-2 text-sm text-white"
            >
              {copied ? t('detalhe.copiado') : t('detalhe.copiar')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('detalhe.semLink')}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-black">
          {t('detalhe.participantes')} ({metadata?.participants?.length ?? 0})
        </h4>
        {!metadata?.participants?.length ? (
          <p className="text-sm text-gray-500">
            {t('detalhe.semParticipantes')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {metadata.participants.map(p => {
              const displayName = p.name || p.short || p.phone
              return (
                <li
                  key={p.phone}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GrupoAvatar src={p.imgUrl} label={displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-black">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {p.phone}
                      </p>
                      {p.isAdmin && (
                        <span className="text-xs text-[#5A997E]">
                          {t('detalhe.admin')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoveModal({ phone: p.phone })}
                    className="shrink-0 cursor-pointer text-xs text-red-600 hover:text-red-800"
                  >
                    {t('detalhe.remover')}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-black">
          {t('detalhe.adicionarParticipantes')}
        </h4>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={autoInvite}
            onChange={e => setAutoInvite(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-700">
            {t('detalhe.autoInvite')}
          </span>
        </label>
        <ParticipantesPicker
          authTokenKey={authTokenKey}
          onAddParticipant={addPendingParticipant}
          onError={setSectionError}
        />
        {pendingPhones.length > 0 && (
          <ul className="text-sm text-gray-700">
            {pendingPhones.map(phone => (
              <li key={phone} className="flex justify-between py-1">
                {phone}
                <button
                  type="button"
                  onClick={() =>
                    setPendingPhones(prev => prev.filter(p => p !== phone))
                  }
                  className="text-xs text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => void handleConfirmAddParticipants()}
          disabled={pendingPhones.length === 0 || mutations.loading}
          className="w-fit cursor-pointer rounded-md bg-[#5A997E] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {t('detalhe.confirmarAdicionar')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setLeaveModalOpen(true)}
        className="w-fit cursor-pointer rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        {t('detalhe.sairGrupo')}
      </button>

      <ConfirmModal
        isOpen={leaveModalOpen}
        title={t('modal.sairTitulo')}
        message={t('modal.sairMensagem')}
        confirmLabel={
          mutations.loading ? t('modal.saindo') : t('modal.confirmar')
        }
        cancelLabel={t('modal.cancelar')}
        loading={mutations.loading}
        onConfirm={() => void handleLeave()}
        onClose={() => setLeaveModalOpen(false)}
      />

      <ConfirmModal
        isOpen={!!removeModal}
        title={t('modal.removerTitulo')}
        message={t('modal.removerMensagem', {
          phone: removeModal?.phone ?? '',
        })}
        confirmLabel={t('modal.confirmar')}
        cancelLabel={t('modal.cancelar')}
        loading={mutations.loading}
        onConfirm={() => {
          if (removeModal) void handleRemoveParticipant(removeModal.phone)
        }}
        onClose={() => setRemoveModal(null)}
      />
    </div>
  )
}
