'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateGroup, type CreatedGroup } from '@/app/hooks/use-create-group'
import type { BitrixContact } from '@/app/hooks/use-bitrix-contacts'
import { GrupoCriadoSucesso } from './grupo-criado-sucesso'
import { ParticipantesPicker } from './participantes-picker'

type Participant = {
  phone: string
  contactId?: string
  contactName?: string
}

type Props = {
  connectorId: string
  isConnected: boolean
  authTokenKey: string
  onBack?: () => void
  onViewList?: () => void
}

function normalizePhoneInput(value: string): string {
  const hasInternationalPrefix = value.startsWith('+') || value.startsWith('00')
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  digits = digits.replace(/^0+/, '')
  if (!hasInternationalPrefix && (digits.length === 10 || digits.length === 11))
    return `55${digits}`
  return digits
}

function isValidPhone(value: string): boolean {
  return /^\d{8,15}$/.test(normalizePhoneInput(value))
}

export function CriarGrupoTab({
  connectorId,
  isConnected,
  authTokenKey,
  onBack,
  onViewList,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/criar-grupo')
  const {
    createGroup,
    loading: creating,
    error,
    setError,
  } = useCreateGroup(authTokenKey)

  const [groupName, setGroupName] = useState('')
  const [autoInvite, setAutoInvite] = useState(true)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [createdGroup, setCreatedGroup] = useState<CreatedGroup | null>(null)

  const addParticipant = (phone: string, contact?: BitrixContact) => {
    const normalized = normalizePhoneInput(phone)
    if (!isValidPhone(phone)) return false
    if (participants.some(p => normalizePhoneInput(p.phone) === normalized)) {
      return false
    }
    setParticipants(prev => [
      ...prev,
      {
        phone,
        contactId: contact?.id,
        contactName: contact?.name,
      },
    ])
    return true
  }

  const handleSubmit = async () => {
    setError(null)
    if (!groupName.trim()) {
      setError(t('erroNome'))
      return
    }
    if (participants.length === 0) {
      setError(t('erroParticipantes'))
      return
    }

    const result = await createGroup({
      connectorId,
      groupName: groupName.trim(),
      autoInvite,
      phones: participants.map(p => p.phone),
    })

    if (result) {
      setCreatedGroup(result)
    }
  }

  const handleCreateAnother = () => {
    setCreatedGroup(null)
    setGroupName('')
    setAutoInvite(true)
    setParticipants([])
    setError(null)
  }

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t('desconectado')}
      </div>
    )
  }

  if (createdGroup) {
    return (
      <GrupoCriadoSucesso
        group={createdGroup}
        onCreateAnother={handleCreateAnother}
        onViewList={onViewList}
      />
    )
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-fit cursor-pointer text-sm text-[#5A997E] hover:underline"
        >
          ← {t('voltarLista', { defaultValue: 'Voltar' })}
        </button>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-black">
          {t('groupName')}
        </label>
        <input
          className="rounded-md border border-gray-200 px-3 py-2 text-sm text-black focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#5A997E]"
          type="text"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={autoInvite}
          onChange={e => setAutoInvite(e.target.checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-gray-700">{t('autoInvite')}</span>
      </label>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-black">
          {t('participantes')}
        </h4>

        <ParticipantesPicker
          authTokenKey={authTokenKey}
          onAddParticipant={addParticipant}
          onError={setError}
        />

        {participants.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-600">
              {t('participantesAdicionados')}
            </p>
            <ul className="flex flex-col gap-1">
              {participants.map((p, index) => (
                <li
                  key={`${p.phone}-${index}`}
                  className="flex items-center justify-between rounded-md border border-gray-100 bg-white px-3 py-2 text-sm"
                >
                  <span>
                    {p.contactName ? `${p.contactName} — ` : ''}
                    {p.phone}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setParticipants(prev =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                    className="cursor-pointer text-xs text-red-600 hover:text-red-800"
                  >
                    {t('remover')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={creating}
        className="w-fit cursor-pointer rounded-md bg-[#5A997E] px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4a8169] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating ? t('criando') : t('criarGrupo')}
      </button>
    </div>
  )
}
