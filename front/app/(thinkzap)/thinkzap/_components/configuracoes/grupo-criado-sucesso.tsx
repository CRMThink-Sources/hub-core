'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreatedGroup } from '@/app/hooks/use-create-group'

type Props = {
  group: CreatedGroup
  onCreateAnother: () => void
  onViewList?: () => void
}

export function GrupoCriadoSucesso({
  group,
  onCreateAnother,
  onViewList,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/criar-grupo')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(group.invitationLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.getElementById(
        'invitation-link-input',
      ) as HTMLInputElement | null
      if (input) {
        input.select()
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-[#5A997E]/30 bg-[#f0fdf4] p-6">
      <h3 className="text-lg font-semibold text-[#144A1B]">
        {t('sucesso.titulo')}
      </h3>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-black">
          {t('sucesso.linkLabel')}
        </label>
        <div className="flex gap-2">
          <input
            id="invitation-link-input"
            readOnly
            value={group.invitationLink}
            className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          />
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="shrink-0 cursor-pointer rounded-md bg-[#5A997E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4a8169]"
          >
            {copied ? t('sucesso.copiado') : t('sucesso.copiar')}
          </button>
        </div>
      </div>

      {group.phone && (
        <p className="text-sm text-gray-600">
          <span className="font-medium">{t('sucesso.grupoId')}:</span>{' '}
          {group.phone}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onViewList && (
          <button
            type="button"
            onClick={onViewList}
            className="cursor-pointer rounded-md bg-[#5A997E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4a8169]"
          >
            {t('sucesso.verLista', { defaultValue: 'Ver na lista' })}
          </button>
        )}
        <button
          type="button"
          onClick={onCreateAnother}
          className="w-fit cursor-pointer rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t('sucesso.criarOutro')}
        </button>
      </div>
    </div>
  )
}
