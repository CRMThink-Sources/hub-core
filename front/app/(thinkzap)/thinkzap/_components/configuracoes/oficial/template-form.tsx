'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateTemplate,
  type TemplateCategory,
} from '@/app/hooks/use-connector-templates'

const CATEGORIES: TemplateCategory[] = [
  'UTILITY',
  'MARKETING',
  'AUTHENTICATION',
]
const LANGUAGES = ['pt_BR', 'en_US', 'es_ES']
const NAME_REGEX = /^[a-z0-9_]+$/
const VAR_REGEX = /\{\{\s*(\d+)\s*\}\}/g

/**
 * Extrai os índices de variáveis `{{n}}` do texto, sem repetição e em ordem
 * crescente. A Meta exige um exemplo para cada variável, senão o template é
 * reprovado automaticamente.
 */
function extractVariables(text: string): number[] {
  const found = new Set<number>()
  for (const match of text.matchAll(VAR_REGEX)) {
    found.add(Number(match[1]))
  }
  return [...found].sort((a, b) => a - b)
}

type Props = {
  itemId: string
  onCreated: () => void
  onCancel: () => void
}

export function TemplateForm({ itemId, onCreated, onCancel }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const { createTemplate, saving, error, setError } = useCreateTemplate()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('UTILITY')
  const [language, setLanguage] = useState('pt_BR')
  const [body, setBody] = useState('')
  const [footer, setFooter] = useState('')
  const [examples, setExamples] = useState<Record<number, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)

  const variables = useMemo(() => extractVariables(body), [body])
  const examplesFilled = variables.every(v => (examples[v] ?? '').trim())

  const nameValid = NAME_REGEX.test(name)
  const canSubmit =
    nameValid && body.trim().length > 0 && examplesFilled && !saving

  const handleSubmit = async () => {
    setLocalError(null)
    setError(null)
    if (!nameValid) {
      setLocalError(t('form.erroNome'))
      return
    }
    if (!body.trim()) {
      setLocalError(t('form.erroBody'))
      return
    }

    if (!examplesFilled) {
      setLocalError(t('form.erroExemplo'))
      return
    }

    // A Meta exige `example.body_text` com um valor por variável, na ordem em
    // que aparecem no texto. Sem isso o template é reprovado na revisão.
    const bodyComponent = {
      type: 'BODY' as const,
      text: body.trim(),
      ...(variables.length
        ? {
            example: {
              body_text: [variables.map(v => examples[v].trim())],
            },
          }
        : {}),
    }

    const components = [
      bodyComponent,
      ...(footer.trim()
        ? [{ type: 'FOOTER' as const, text: footer.trim() }]
        : []),
    ]

    const ok = await createTemplate(itemId, {
      name,
      category,
      language,
      components,
    })
    if (ok) onCreated()
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{t('form.nome')}</Label>
        <Input
          type="text"
          value={name}
          placeholder="order_update"
          onChange={e => setName(e.target.value)}
        />
        <span
          className={`text-xs ${name && !nameValid ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {t('form.nomeHint')}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('form.categoria')}</Label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value as TemplateCategory)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>
              {t(`categoria.${c}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('form.idioma')}</Label>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {LANGUAGES.map(l => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('form.body')}</Label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={4}
          placeholder={t('form.bodyPlaceholder')}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {t('form.bodyHint')}
        </span>
      </div>

      {variables.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs text-muted-foreground">
            {t('form.exemploHint')}
          </span>
          {variables.map(v => (
            <div key={v} className="flex flex-col gap-2">
              <Label>{t('form.exemplo', { variavel: `{{${v}}}` })}</Label>
              <Input
                type="text"
                value={examples[v] ?? ''}
                placeholder={t('form.exemploPlaceholder', {
                  variavel: `{{${v}}}`,
                })}
                onChange={e =>
                  setExamples(prev => ({ ...prev, [v]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>{t('form.footer')}</Label>
        <Input
          type="text"
          value={footer}
          onChange={e => setFooter(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
        >
          {saving ? t('form.enviando') : t('form.enviar')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('form.cancelar')}
        </Button>
        {(localError || error) && (
          <span className="text-sm text-destructive">
            {localError ?? error}
          </span>
        )}
      </div>
    </div>
  )
}
