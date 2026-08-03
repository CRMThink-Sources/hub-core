'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useBitrixContacts,
  type BitrixContact,
} from '@/app/hooks/use-bitrix-contacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

type Props = {
  onAddParticipant: (phone: string, contact?: BitrixContact) => boolean
  onError?: (message: string) => void
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

export function ParticipantesPicker({ onAddParticipant, onError }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/grupos')
  const { contacts, loading: searching, search } = useBitrixContacts()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContact, setSelectedContact] = useState<BitrixContact | null>(
    null,
  )
  const [selectedPhones, setSelectedPhones] = useState<string[]>([])
  const [manualPhone, setManualPhone] = useState('')
  const [manualPhoneForContact, setManualPhoneForContact] = useState('')

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedContact(null)
    setSelectedPhones([])
    search(value)
  }

  const handleSelectContact = (contact: BitrixContact) => {
    setSelectedContact(contact)
    setSelectedPhones([])
    setManualPhoneForContact('')
  }

  const togglePhone = (phone: string) => {
    setSelectedPhones(prev =>
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone],
    )
  }

  const handleAddSelectedPhones = () => {
    if (!selectedContact) return
    let added = false
    for (const phone of selectedPhones) {
      if (onAddParticipant(phone, selectedContact)) added = true
    }
    if (added) {
      setSelectedContact(null)
      setSelectedPhones([])
      setSearchQuery('')
      search('')
    }
  }

  const handleAddManualForContact = () => {
    if (!selectedContact || !manualPhoneForContact.trim()) return
    if (!isValidPhone(manualPhoneForContact)) {
      onError?.(t('picker.erroTelefoneInvalido'))
      return
    }
    if (!onAddParticipant(manualPhoneForContact, selectedContact)) {
      onError?.(t('picker.telefoneJaAdicionado'))
      return
    }
    setSelectedContact(null)
    setManualPhoneForContact('')
    setSearchQuery('')
    search('')
  }

  const handleAddManual = () => {
    if (!manualPhone.trim()) return
    if (!isValidPhone(manualPhone)) {
      onError?.(t('picker.erroTelefoneInvalido'))
      return
    }
    if (!onAddParticipant(manualPhone)) {
      onError?.(t('picker.telefoneJaAdicionado'))
      return
    }
    setManualPhone('')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label>{t('picker.buscarContato')}</Label>
        <Input
          type="text"
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder={t('picker.buscarPlaceholder')}
        />
      </div>

      {searching && (
        <p className="text-xs text-muted-foreground">{t('picker.buscando')}</p>
      )}

      {!searching && searchQuery.length >= 2 && contacts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t('picker.nenhumResultado')}
        </p>
      )}

      {contacts.length > 0 && !selectedContact && (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
          {contacts.map(contact => (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => handleSelectContact(contact)}
                className="w-full cursor-pointer px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
              >
                {contact.name}
                {contact.phones.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({contact.phones.length})
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedContact && (
        <div className="rounded-md border border-border bg-muted p-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            {selectedContact.name}
          </p>

          {selectedContact.phones.length === 0 ? (
            <p className="mb-2 text-xs text-amber-700">
              {t('picker.semTelefone')}
            </p>
          ) : (
            <div className="mb-3 flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t('picker.selecionarTelefones')}
              </p>
              {selectedContact.phones.map(phone => (
                <label
                  key={phone}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedPhones.includes(phone)}
                    onCheckedChange={() => togglePhone(phone)}
                  />
                  {phone}
                </label>
              ))}
            </div>
          )}

          {selectedContact.phones.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleAddSelectedPhones}
              disabled={selectedPhones.length === 0}
              className="mb-3"
            >
              {t('picker.adicionarSelecionados')}
            </Button>
          )}

          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              type="text"
              value={manualPhoneForContact}
              onChange={e => setManualPhoneForContact(e.target.value)}
              placeholder={t('picker.telefoneManualPlaceholder')}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddManualForContact}
              className="shrink-0"
            >
              {t('picker.adicionar')}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedContact(null)
              setSelectedPhones([])
            }}
            className="mt-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>{t('picker.telefoneManual')}</Label>
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            type="text"
            value={manualPhone}
            onChange={e => setManualPhone(e.target.value)}
            placeholder={t('picker.telefoneManualPlaceholder')}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddManual}
            className="shrink-0"
          >
            {t('picker.adicionar')}
          </Button>
        </div>
      </div>
    </div>
  )
}
