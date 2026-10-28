'use client'

import { Copy, ExternalLink, ImageIcon, Phone, Reply } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TemplateButtonType } from '@/app/hooks/use-connector-templates'
import { previewSegments } from './template-view'

const BUTTON_ICON: Record<TemplateButtonType, typeof Reply> = {
  QUICK_REPLY: Reply,
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
}

type Props = {
  header: 'NONE' | 'IMAGE'
  /** Imagem do cabeçalho; vazia mostra o lugar da imagem. */
  imageUrl?: string
  body: string
  footer?: string
  buttons?: { type: TemplateButtonType; text?: string }[]
  className?: string
}

/**
 * O template como o contato vai recebê-lo no WhatsApp: cabeçalho de imagem, corpo
 * com as variáveis destacadas, rodapé e botões. Usado no formulário (ao vivo) e
 * nos detalhes do template.
 */
export function TemplatePreview({
  header,
  imageUrl,
  body,
  footer,
  buttons = [],
  className,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')

  return (
    <div
      className={`rounded-xl bg-[#efeae2] p-4 dark:bg-[#0b141a] ${className ?? ''}`}
    >
      <div className="max-w-[320px] overflow-hidden rounded-lg bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]">
        {header === 'IMAGE' &&
          (imageUrl ? (
            <img
              src={imageUrl}
              alt={t('preview.imagem')}
              className="aspect-[1.91/1] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[1.91/1] w-full items-center justify-center gap-2 bg-black/5 text-xs text-black/50 dark:bg-white/5 dark:text-white/50">
              <ImageIcon className="size-4" aria-hidden />
              {t('preview.imagem')}
            </div>
          ))}

        <div className="flex flex-col gap-1 px-3 pt-2 pb-1.5">
          <p className="text-sm leading-snug whitespace-pre-wrap break-words">
            {body.trim() ? (
              previewSegments(body).map((segment, i) =>
                segment.variable ? (
                  <span
                    key={i}
                    className="rounded bg-emerald-100 px-0.5 font-medium text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                  >
                    {segment.text}
                  </span>
                ) : (
                  <span key={i}>{segment.text}</span>
                ),
              )
            ) : (
              <span className="text-black/40 dark:text-white/40">
                {t('preview.corpoVazio')}
              </span>
            )}
          </p>
          {footer?.trim() ? (
            <p className="text-xs text-black/50 dark:text-white/50">
              {footer.trim()}
            </p>
          ) : null}
          <span className="self-end text-[11px] text-black/45 dark:text-white/45">
            10:24
          </span>
        </div>

        {buttons.map((button, i) => {
          const Icon = BUTTON_ICON[button.type]
          const label =
            button.type === 'COPY_CODE'
              ? t('preview.copiarCodigo')
              : button.text?.trim() || t(`botoes.tipo.${button.type}`)
          return (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 border-t border-black/10 px-3 py-2 text-sm font-medium text-[#027eb5] dark:border-white/10 dark:text-[#53bdeb]"
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
