'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { axiosThinkzap } from '@/infra/client/axios-thinkzap'
type Connector = {
  id: string
  instance: {
    name: string
    phoneNumber?: string | null
  }
}

type Props = {
  connector: Connector
  authTokenKey: string
  onSaved?: () => void
}

export function GeralTab({ connector, authTokenKey, onSaved }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/geral')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setName(connector.instance.name ?? '')
  }, [connector])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const client = axiosThinkzap(authTokenKey)
      await client.put(`/thinkzap/instance/${connector.id}`, {
        name,
      })
      setSaved(true)
      onSaved?.()
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Erro ao salvar:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-black">
          {t('nomeCanal')}
        </label>
        <input
          className="rounded-md border border-gray-200 px-3 py-2 text-sm text-black focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#5A997E]"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-black">
          {t('telefone')}
        </label>
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {connector.instance.phoneNumber || t('semTelefone')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !name.trim()}
          className="cursor-pointer rounded-md bg-[#5A997E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4a8169] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? t('salvando') : t('salvar')}
        </button>
        {saved && <span className="text-sm text-[#5A997E]">{t('salvo')}</span>}
      </div>
    </div>
  )
}
