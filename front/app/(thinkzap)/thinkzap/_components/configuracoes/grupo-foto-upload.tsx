'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GrupoAvatar } from './grupo-avatar'
import { Button } from '@/components/ui/button'

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
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <GrupoAvatar src={displayUrl} label={label} size="lg" />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            {t('detalhe.fotoHint')}
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            disabled={uploading}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-fit"
          >
            {uploading
              ? t('detalhe.enviandoFoto')
              : t('detalhe.selecionarFoto')}
          </Button>

          {selectedName && !uploading && (
            <p className="truncate text-xs text-muted-foreground">
              {t('detalhe.arquivoSelecionado', { nome: selectedName })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
