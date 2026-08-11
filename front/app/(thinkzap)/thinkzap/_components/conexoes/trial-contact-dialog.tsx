'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Espelha `SpaClientContact` da api. */
export type TrialContact = {
  name: string
  email: string
  phone: string
  company: string
}

type Field = keyof TrialContact

const FIELDS: Field[] = ['name', 'email', 'phone', 'company']

/**
 * Validação de campo vazio e formato de e-mail, e **só**.
 *
 * O telefone não é normalizado aqui de propósito: `normalizePhoneNumber` vive na
 * api, e uma segunda cópia em TypeScript no front seriam duas regras que divergem
 * na primeira correção. O front manda o que foi digitado; o servidor normaliza e
 * devolve `400` com o campo quando o número não fecha.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContact(
  contact: TrialContact,
): Partial<Record<Field, true>> {
  const errors: Partial<Record<Field, true>> = {}

  if (contact.name.trim().length < 2) errors.name = true
  if (!EMAIL.test(contact.email.trim())) errors.email = true
  if (contact.phone.trim().length === 0) errors.phone = true
  if (contact.company.trim().length === 0) errors.company = true

  return errors
}

/**
 * Confirmação dos dados de contato antes de ativar o teste.
 *
 * Aparece sempre, mesmo com os quatro campos preenchidos: o e-mail conhecido é o
 * da instalação — técnico, muitas vezes de quem instalou e não de quem decide.
 * Confirmar custa um clique e é a diferença entre um contato correto e um endereço
 * que ninguém lê.
 */
export function TrialContactDialog({
  open,
  initial,
  submitting,
  serverField,
  onCancel,
  onSubmit,
}: {
  open: boolean
  initial: TrialContact
  submitting: boolean
  /** Campo que a api recusou, para marcar o input sem perder o que foi digitado. */
  serverField: Field | null
  onCancel: () => void
  onSubmit: (contact: TrialContact) => void
}) {
  const { t } = useTranslation('thinkzap/conexoes/trial')
  const [contact, setContact] = useState<TrialContact>(initial)
  const [errors, setErrors] = useState<Partial<Record<Field, true>>>({})

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const found = validateContact(contact)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    onSubmit({
      name: contact.name.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
      company: contact.company.trim(),
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next && !submitting) onCancel()
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('formulario.titulo')}</DialogTitle>
            <DialogDescription>{t('formulario.descricao')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            {FIELDS.map(field => {
              const invalid = errors[field] || serverField === field

              return (
                <div key={field} className="flex flex-col gap-1.5">
                  <Label htmlFor={`trial-contact-${field}`}>
                    {t(`formulario.${field}.rotulo`)}
                  </Label>
                  <Input
                    id={`trial-contact-${field}`}
                    name={field}
                    type={field === 'email' ? 'email' : 'text'}
                    inputMode={field === 'phone' ? 'tel' : undefined}
                    autoComplete={AUTOCOMPLETE[field]}
                    value={contact[field]}
                    disabled={submitting}
                    aria-invalid={invalid || undefined}
                    placeholder={t(`formulario.${field}.exemplo`)}
                    onChange={event => {
                      const value = event.target.value
                      setContact(current => ({ ...current, [field]: value }))
                      setErrors(current => ({ ...current, [field]: undefined }))
                    }}
                  />
                  {invalid ? (
                    <p className="text-sm text-destructive">
                      {t(`formulario.${field}.erro`)}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={onCancel}
            >
              {t('formulario.cancelar')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : null}
              {submitting ? t('ativando') : t('formulario.confirmar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const AUTOCOMPLETE: Record<Field, string> = {
  name: 'name',
  email: 'email',
  phone: 'tel',
  company: 'organization',
}
