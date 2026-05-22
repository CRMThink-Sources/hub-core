'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GrupoAvatar } from './grupo-avatar'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

type Props = {
  currentPhotoUrl?: string | null
  label: string
  uploading?: boolean
  onFileSelect: (file: File) => void
  onError?: (message: string) => void
}

export function GrupoFotoUpload({
  currentPhotoUrl,
  label,
  uploading = false,
  onFileSelect,
  onError,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/grupos')
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const displayUrl = previewUrl ?? currentPhotoUrl ?? null

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_PHOTO_BYTES) {
      onError?.(t('detalhe.fotoGrande'))
      e.target.value = ''
      return
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setSelectedName(file.name)
    onFileSelect(file)
    e.target.value = ''
  }

  return (
    <div className="rounded-lg border border-dashed border-[#5A997E]/40 bg-[#f8fdf9] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <GrupoAvatar src={displayUrl} label={label} size="lg" />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs text-gray-500">{t('detalhe.fotoHint')}</p>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploading}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-fit cursor-pointer rounded-md border border-[#5A997E] bg-white px-4 py-2 text-sm font-medium text-[#5A997E] transition-colors hover:bg-[#d9fce6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? t('detalhe.enviandoFoto')
              : t('detalhe.selecionarFoto')}
          </button>

          {selectedName && !uploading && (
            <p className="truncate text-xs text-gray-600">
              {t('detalhe.arquivoSelecionado', { nome: selectedName })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
