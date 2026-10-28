'use client'

import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  TemplateButton,
  TemplateButtonType,
  TemplateCategory,
} from '@/app/hooks/use-connector-templates'
import {
  allowedButtonTypes,
  canAddButton,
  isDynamicUrl,
  TEMPLATE_BUTTON_LIMITS,
  type TemplateButtonViolation,
} from './template-buttons'

const EMPTY_BUTTON: Record<TemplateButtonType, TemplateButton> = {
  QUICK_REPLY: { type: 'QUICK_REPLY', text: '' },
  URL: { type: 'URL', text: '', url: '' },
  PHONE_NUMBER: { type: 'PHONE_NUMBER', text: '', phone_number: '' },
  COPY_CODE: { type: 'COPY_CODE', example: '' },
}

type Props = {
  buttons: TemplateButton[]
  category: TemplateCategory
  /** Mostradas só depois da primeira tentativa de envio, para não gritar enquanto digita. */
  violations: TemplateButtonViolation[]
  onChange: (buttons: TemplateButton[]) => void
  /** Falso quando o editor está num painel que já mostra o título. */
  showHeader?: boolean
}

/**
 * Lista de botões do template, na ordem em que o operador adicionou. A ordem que vai
 * para a Meta (respostas rápidas primeiro) é aplicada só ao montar o componente —
 * reordenar aqui faria o botão "pular" de lugar enquanto o operador edita.
 */
export function TemplateButtonsEditor({
  buttons,
  category,
  violations,
  onChange,
  showHeader = true,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')

  const types = allowedButtonTypes(category)
  if (types.length === 0) return null

  const update = (index: number, button: TemplateButton) =>
    onChange(buttons.map((current, i) => (i === index ? button : current)))
  const remove = (index: number) =>
    onChange(buttons.filter((_, i) => i !== index))

  const errorsAt = (index: number) =>
    violations
      .filter(violation => violation.index === index)
      .map(violation => t(`form.botoes.erros.${violation.code}`))
  const generalErrors = violations
    .filter(violation => violation.index === undefined)
    .map(violation => t(`form.botoes.erros.${violation.code}`))

  return (
    <div className="flex flex-col gap-3">
      {showHeader && (
        <div className="flex flex-col gap-1">
          <Label>{t('form.botoes.titulo')}</Label>
          <span className="text-xs text-muted-foreground">
            {t('form.botoes.hint', { max: TEMPLATE_BUTTON_LIMITS.total })}
          </span>
        </div>
      )}

      {buttons.map((button, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md bg-muted/60 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {t(`botoes.tipo.${button.type}`)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('form.botoes.remover')}
              onClick={() => remove(index)}
            >
              <X />
            </Button>
          </div>

          <ButtonFields
            button={button}
            onChange={next => update(index, next)}
          />

          {errorsAt(index).map(message => (
            <span key={message} className="text-xs text-destructive">
              {message}
            </span>
          ))}
        </div>
      ))}

      {generalErrors.map(message => (
        <span key={message} className="text-xs text-destructive">
          {message}
        </span>
      ))}

      <div className="flex flex-wrap gap-2">
        {types.map(type => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            disabled={!canAddButton(buttons, type, category)}
            onClick={() => onChange([...buttons, EMPTY_BUTTON[type]])}
          >
            + {t(`botoes.tipo.${type}`)}
          </Button>
        ))}
      </div>
    </div>
  )
}

function ButtonFields({
  button,
  onChange,
}: {
  button: TemplateButton
  onChange: (button: TemplateButton) => void
}) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')

  const textField = 'text' in button && (
    <Input
      type="text"
      value={button.text}
      maxLength={TEMPLATE_BUTTON_LIMITS.textLength}
      placeholder={t('form.botoes.texto')}
      aria-label={t('form.botoes.texto')}
      onChange={e => onChange({ ...button, text: e.target.value })}
    />
  )

  switch (button.type) {
    case 'QUICK_REPLY':
      return textField
    case 'URL':
      return (
        <>
          {textField}
          <Input
            type="text"
            value={button.url}
            placeholder="https://loja.com/pedido/{{1}}"
            aria-label={t('form.botoes.url')}
            onChange={e => onChange({ ...button, url: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            {t('form.botoes.urlHint')}
          </span>
          {isDynamicUrl(button.url) && (
            <Input
              type="text"
              value={button.example?.[0] ?? ''}
              placeholder="https://loja.com/pedido/123"
              aria-label={t('form.botoes.urlExemplo')}
              onChange={e => onChange({ ...button, example: [e.target.value] })}
            />
          )}
        </>
      )
    case 'PHONE_NUMBER':
      return (
        <>
          {textField}
          <Input
            type="tel"
            value={button.phone_number}
            maxLength={TEMPLATE_BUTTON_LIMITS.phoneLength}
            placeholder="+5511999999999"
            aria-label={t('form.botoes.telefone')}
            onChange={e =>
              onChange({ ...button, phone_number: e.target.value })
            }
          />
          <span className="text-xs text-muted-foreground">
            {t('form.botoes.telefoneHint')}
          </span>
        </>
      )
    case 'COPY_CODE':
      return (
        <>
          <Input
            type="text"
            value={button.example}
            maxLength={TEMPLATE_BUTTON_LIMITS.codeLength}
            placeholder="BLACK10"
            aria-label={t('form.botoes.codigo')}
            onChange={e => onChange({ ...button, example: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">
            {t('form.botoes.codigoHint')}
          </span>
        </>
      )
  }
}
