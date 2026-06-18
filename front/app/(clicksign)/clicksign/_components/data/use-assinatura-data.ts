'use client'

import { useEffect, useState } from 'react'
import { axiosClicksign } from '@/infra/client/axios-clicksign'
import type { Option } from '../types'
import type { BitrixFields } from '../assinatura/grupo-card'
import type { ClickSignField } from './types'

const EMPTY: BitrixFields = {
  stringFields: [],
  dateFields: [],
  fileFields: [],
  contactFields: [],
  userFields: [],
  users: [],
}

function toOption(f: ClickSignField): Option {
  return { code: f.code, name: f.name }
}

// Separa os campos do negócio por tipo, espelhando o app original.
function categorize(fields: ClickSignField[], users: Option[]): BitrixFields {
  return {
    stringFields: fields.filter(f => f.type === 'string').map(toOption),
    dateFields: fields.filter(f => f.type === 'date').map(toOption),
    fileFields: fields.filter(f => f.type === 'file').map(toOption),
    contactFields: fields.filter(f => f.crmContact).map(toOption),
    userFields: fields
      .filter(f => f.type === 'user' || (f.type === 'employee' && !f.isMultiple))
      .map(toOption),
    users,
  }
}

export function useAssinaturaData() {
  const [fields, setFields] = useState<BitrixFields>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      axiosClicksign().get('/clicksign/bitrix/fields?entity=deal') as unknown as Promise<{
        fields: ClickSignField[]
      }>,
      axiosClicksign().get('/clicksign/bitrix/users') as unknown as Promise<{
        users: { id: number; name: string }[]
      }>,
    ])
      .then(([fieldsRes, usersRes]) => {
        if (!active) return
        const users: Option[] = (usersRes.users ?? []).map(u => ({
          code: String(u.id),
          name: u.name,
        }))
        setFields(categorize(fieldsRes.fields ?? [], users))
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Falha ao carregar dados')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { fields, loading, error }
}
