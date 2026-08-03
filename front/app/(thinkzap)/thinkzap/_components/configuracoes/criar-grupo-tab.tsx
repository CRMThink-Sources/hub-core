'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateGroup, type CreatedGroup } from '@/app/hooks/use-create-group'
import type { BitrixContact } from '@/app/hooks/use-bitrix-contacts'
import { GrupoCriadoSucesso } from './grupo-criado-sucesso'
import { ParticipantesPicker } from './participantes-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

type Participant = {
  phone: string
  contactId?: string
  contactName?: string
}

type Props = {
  itemId: string
  isConnected: boolean
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
  itemId,
  isConnected,
  onBack,
  onViewList,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/criar-grupo')
  const { createGroup, loading: creating, error, setError } = useCreateGroup()

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
      itemId,
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
          className="w-fit cursor-pointer text-sm text-primary hover:underline"
        >
          ← {t('voltarLista', { defaultValue: 'Voltar' })}
        </button>
      )}

      <div className="flex flex-col gap-2">
        <Label>{t('groupName')}</Label>
        <Input
          type="text"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2">
        <Checkbox
          checked={autoInvite}
          onCheckedChange={(checked: boolean) => setAutoInvite(checked)}
          className="mt-0.5"
        />
        <span className="text-sm text-foreground">{t('autoInvite')}</span>
      </label>

      <div className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-foreground">
          {t('participantes')}
        </h4>

        <ParticipantesPicker
          onAddParticipant={addParticipant}
          onError={setError}
        />

        {participants.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t('participantesAdicionados')}
            </p>
            <ul className="flex flex-col gap-1">
              {participants.map((p, index) => (
                <li
                  key={`${p.phone}-${index}`}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
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
                    className="cursor-pointer text-xs text-destructive hover:underline"
                  >
                    {t('remover')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        size="lg"
        onClick={() => void handleSubmit()}
        disabled={creating}
        className="w-fit"
      >
        {creating ? t('criando') : t('criarGrupo')}
      </Button>
    </div>
  )
}
