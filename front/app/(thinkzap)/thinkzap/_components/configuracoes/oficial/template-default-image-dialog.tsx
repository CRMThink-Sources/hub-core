'use client'

import { useEffect, useState } from 'react'
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
import {
  useSetTemplateDefaultImage,
  type ConnectorTemplate,
} from '@/app/hooks/use-connector-templates'
import {
  HEADER_IMAGE_TYPES,
  validateTemplateHeader,
  validateTemplateHeaderFile,
} from './template-header'

type Props = {
  itemId: string
  /** Template aberto; `null` fecha o diálogo. */
  template: ConnectorTemplate | null
  onClose: () => void
  onSaved: (template: ConnectorTemplate, headerImageUrl: string) => void
}

/**
 * Define ou troca a imagem padrão do envio: a que o widget e o robô usam quando
 * ninguém informa outra. Arquivo ou link, com as mesmas regras da imagem de
 * exemplo.
 */
export function TemplateDefaultImageDialog({
  itemId,
  template,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const { setDefaultImage, saving, error, setError } =
    useSetTemplateDefaultImage()
  const [source, setSource] = useState<'FILE' | 'LINK'>('FILE')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState('')
  const [url, setUrl] = useState('')

  // Cada abertura começa limpa.
  useEffect(() => {
    setSource('FILE')
    setFile(null)
    setUrl('')
    setError(null)
  }, [template, setError])

  useEffect(() => {
    if (!file) {
      setFilePreview('')
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setFilePreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const category = template?.category ?? 'MARKETING'
  const violation =
    source === 'FILE'
      ? validateTemplateHeaderFile('IMAGE', file, category)
      : validateTemplateHeader('IMAGE', url, category)
  const touched = source === 'FILE' ? file !== null : url.trim() !== ''
  const preview =
    violation === null
      ? source === 'FILE'
        ? filePreview
        : url.trim()
      : (template?.defaultImageUrl ?? '')

  const save = async () => {
    if (!template || violation) return
    const saved = await setDefaultImage(
      itemId,
      template,
      source === 'FILE' && file ? { file } : { imageUrl: url },
    )
    if (saved) onSaved(template, saved)
  }

  return (
    <Dialog
      open={template !== null}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('imagemPadrao.titulo')}</DialogTitle>
          <DialogDescription>
            {t('imagemPadrao.descricao', { nome: template?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {preview ? (
            <img
              src={preview}
              alt={t('imagemPadrao.titulo')}
              className="aspect-[1.91/1] w-full rounded-lg bg-muted object-cover"
            />
          ) : (
            <div className="flex aspect-[1.91/1] w-full items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              {t('imagemPadrao.semImagem')}
            </div>
          )}

          <div
            role="radiogroup"
            aria-label={t('imagemPadrao.titulo')}
            className="inline-flex h-9 w-fit items-center rounded-lg bg-muted p-1"
          >
            {(['FILE', 'LINK'] as const).map(option => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={source === option}
                onClick={() => setSource(option)}
                className={`h-7 rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                  source === option
                    ? 'bg-background font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(
                  option === 'FILE'
                    ? 'form.cabecalho.fonteArquivo'
                    : 'form.cabecalho.fonteLink',
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="default-image-input">
              {t(
                source === 'FILE'
                  ? 'imagemPadrao.arquivo'
                  : 'imagemPadrao.link',
              )}
            </Label>
            {source === 'FILE' ? (
              <Input
                id="default-image-input"
                type="file"
                accept={HEADER_IMAGE_TYPES.join(',')}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                aria-describedby="default-image-hint"
              />
            ) : (
              <Input
                id="default-image-input"
                type="url"
                value={url}
                placeholder="https://..."
                onChange={e => setUrl(e.target.value)}
                aria-describedby="default-image-hint"
              />
            )}
            <span
              id="default-image-hint"
              className={`text-xs ${
                touched && violation
                  ? 'text-destructive'
                  : 'text-muted-foreground'
              }`}
            >
              {touched && violation
                ? t(`imagemPadrao.erros.${violation}`, {
                    defaultValue: t(`form.cabecalho.erros.${violation}`),
                  })
                : t('imagemPadrao.hint')}
            </span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('form.cancelar')}
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={violation !== null || saving}
          >
            {saving ? t('imagemPadrao.salvando') : t('imagemPadrao.salvar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
