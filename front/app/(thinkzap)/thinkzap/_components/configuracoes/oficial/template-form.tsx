'use client'

import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useCreateTemplate,
  useUpdateTemplate,
  type ConnectorTemplate,
  type TemplateButton,
  type TemplateCategory,
} from '@/app/hooks/use-connector-templates'
import { TemplateButtonsEditor } from './template-buttons-editor'
import {
  allowedButtonTypes,
  buildButtonsComponent,
  validateTemplateButtons,
} from './template-buttons'
import {
  buildHeaderComponent,
  HEADER_IMAGE_TYPES,
  headerAllowed,
  validateTemplateHeader,
  validateTemplateHeaderFile,
  validateTemplateHeaderKeep,
  type TemplateHeaderChoice,
  type TemplateHeaderSource,
} from './template-header'
import { TemplatePreview } from './template-preview'
import { categoryLocked, formInitialOf } from './template-view'

const CATEGORIES: TemplateCategory[] = [
  'UTILITY',
  'MARKETING',
  'AUTHENTICATION',
]
const LANGUAGES = ['pt_BR', 'en_US', 'es_ES']
const NAME_REGEX = /^[a-z0-9_]+$/
const VAR_REGEX = /\{\{\s*(\d+)\s*\}\}/g

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70'

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
  /** Template a editar; ausente = criação. */
  template?: ConnectorTemplate
  onSaved: () => void
  onCancel: () => void
}

/**
 * Criação e edição de template, com a prévia ao vivo ao lado. Na edição, nome e
 * idioma não mudam (regra da Meta), a categoria trava em template aprovado, e a
 * imagem pode ser mantida — a API manda a imagem padrão do envio como amostra.
 */
export function TemplateForm({ itemId, template, onSaved, onCancel }: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/templates')
  const editing = template !== undefined
  const initial = useMemo(
    () => (template ? formInitialOf(template) : undefined),
    [template],
  )
  const create = useCreateTemplate()
  const update = useUpdateTemplate()
  const saving = create.saving || update.saving
  const error = editing ? update.error : create.error

  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<TemplateCategory>(
    initial?.category ?? 'UTILITY',
  )
  const [language, setLanguage] = useState(initial?.language ?? 'pt_BR')
  const [body, setBody] = useState(initial?.body ?? '')
  const [footer, setFooter] = useState(initial?.footer ?? '')
  const [header, setHeader] = useState<TemplateHeaderChoice>(
    initial?.header ?? 'NONE',
  )
  const [headerImageUrl, setHeaderImageUrl] = useState('')
  /**
   * Na edição de template com imagem, manter a atual é o padrão. Na criação, o
   * arquivo: é o caminho que evita link do Drive ou copiado da Meta.
   */
  const canKeepImage = initial?.header === 'IMAGE'
  const [headerSource, setHeaderSource] = useState<TemplateHeaderSource>(
    canKeepImage ? 'KEEP' : 'FILE',
  )
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null)
  const [headerFilePreview, setHeaderFilePreview] = useState('')
  const [examples, setExamples] = useState<Record<number, string>>(
    initial?.examples ?? {},
  )
  const [buttons, setButtons] = useState<TemplateButton[]>(
    initial?.buttons ?? [],
  )
  const [showButtonErrors, setShowButtonErrors] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const lockCategory = template ? categoryLocked(template.status) : false

  const buttonViolations = useMemo(
    () => validateTemplateButtons(buttons, category),
    [buttons, category],
  )

  // Botão que a nova categoria não aceita sai da lista em vez de travar o envio.
  const changeCategory = (next: TemplateCategory) => {
    const allowed = allowedButtonTypes(next)
    setCategory(next)
    setButtons(prev => prev.filter(button => allowed.includes(button.type)))
    // Autenticação não tem cabeçalho: ele sai junto, como os botões.
    if (!headerAllowed(next)) setHeader('NONE')
  }

  /** Preview do arquivo por object URL, liberada ao trocar de arquivo ou sair. */
  useEffect(() => {
    if (!headerImageFile) {
      setHeaderFilePreview('')
      return
    }
    const url = URL.createObjectURL(headerImageFile)
    setHeaderFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [headerImageFile])

  const headerViolation =
    headerSource === 'KEEP'
      ? validateTemplateHeaderKeep(
          header,
          Boolean(template?.defaultImageUrl),
          category,
        )
      : headerSource === 'FILE'
        ? validateTemplateHeaderFile(header, headerImageFile, category)
        : validateTemplateHeader(header, headerImageUrl, category)
  const headerPreviewUrl =
    header !== 'IMAGE'
      ? ''
      : headerSource === 'KEEP'
        ? (template?.defaultImageUrl ?? '')
        : headerSource === 'FILE'
          ? headerViolation === null
            ? headerFilePreview
            : ''
          : headerViolation !== 'example_required' &&
              headerViolation !== 'example_not_https'
            ? headerImageUrl.trim()
            : ''
  /** Erro do cabeçalho só aparece depois que o operador preencheu algo. */
  const headerTouched =
    headerSource === 'KEEP'
      ? true
      : headerSource === 'FILE'
        ? headerImageFile !== null
        : headerImageUrl.trim() !== ''

  const variables = useMemo(() => extractVariables(body), [body])
  const examplesFilled = variables.every(v => (examples[v] ?? '').trim())

  const nameValid = NAME_REGEX.test(name)
  const canSubmit =
    nameValid &&
    body.trim().length > 0 &&
    examplesFilled &&
    headerViolation === null &&
    !saving

  const handleSubmit = async () => {
    setLocalError(null)
    create.setError(null)
    update.setError(null)
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

    if (headerViolation) {
      setLocalError(t(`form.cabecalho.erros.${headerViolation}`))
      return
    }

    if (buttonViolations.length > 0) {
      setShowButtonErrors(true)
      setLocalError(t('form.botoes.erroGeral'))
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

    const buttonsComponent = buildButtonsComponent(buttons)
    const headerComponent = buildHeaderComponent(
      header,
      headerSource,
      headerImageUrl,
    )
    // A ordem é a da Meta: cabeçalho, corpo, rodapé, botões.
    const components = [
      ...(headerComponent ? [headerComponent] : []),
      bodyComponent,
      ...(footer.trim()
        ? [{ type: 'FOOTER' as const, text: footer.trim() }]
        : []),
      ...(buttonsComponent ? [buttonsComponent] : []),
    ]
    const file =
      header === 'IMAGE' && headerSource === 'FILE' && headerImageFile
        ? headerImageFile
        : undefined
    const payload = { name, category, language, components }

    const ok = template
      ? await update.updateTemplate(itemId, template.id, payload, file)
      : await create.createTemplate(itemId, payload, file)
    if (ok) onSaved()
  }

  const headerSources: TemplateHeaderSource[] = canKeepImage
    ? ['KEEP', 'FILE', 'LINK']
    : ['FILE', 'LINK']

  return (
    <div className="flex max-w-[66rem] flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          aria-label={t('form.voltar')}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {editing
              ? t('form.tituloEditar', { nome: template.name })
              : t('form.tituloNovo')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {editing ? t('form.subtituloEditar') : t('form.subtituloNovo')}
          </p>
        </div>
      </div>

      {editing && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t('form.avisoEdicao')}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,42rem)_340px]">
        <div className="flex min-w-0 flex-col gap-8">
          <FormSection title={t('form.secaoIdentificacao')}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-name">{t('form.nome')}</Label>
              <Input
                id="template-name"
                type="text"
                value={name}
                placeholder="order_update"
                disabled={editing}
                onChange={e => setName(e.target.value)}
                aria-describedby="template-name-hint"
              />
              <span
                id="template-name-hint"
                className={`text-xs ${name && !nameValid ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {editing ? t('form.nomeTravado') : t('form.nomeHint')}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-category">{t('form.categoria')}</Label>
                <select
                  id="template-category"
                  value={category}
                  disabled={lockCategory}
                  onChange={e =>
                    changeCategory(e.target.value as TemplateCategory)
                  }
                  className={SELECT_CLASS}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {t(`categoria.${c}`)}
                    </option>
                  ))}
                </select>
                {lockCategory && (
                  <span className="text-xs text-muted-foreground">
                    {t('form.categoriaTravada')}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-language">{t('form.idioma')}</Label>
                <select
                  id="template-language"
                  value={language}
                  disabled={editing}
                  onChange={e => setLanguage(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {LANGUAGES.map(l => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          {headerAllowed(category) && (
            <FormSection title={t('form.cabecalho.titulo')}>
              <SegmentedChoice
                label={t('form.cabecalho.titulo')}
                value={header}
                options={[
                  ['NONE', t('form.cabecalho.nenhum')],
                  ['IMAGE', t('form.cabecalho.imagem')],
                ]}
                onChange={setHeader}
              />

              {header === 'IMAGE' && (
                <div className="flex flex-col gap-3">
                  <SegmentedChoice
                    label={t('form.cabecalho.fonte')}
                    value={headerSource}
                    options={headerSources.map(source => [
                      source,
                      t(
                        source === 'KEEP'
                          ? 'form.cabecalho.fonteManter'
                          : source === 'FILE'
                            ? 'form.cabecalho.fonteArquivo'
                            : 'form.cabecalho.fonteLink',
                      ),
                    ])}
                    onChange={setHeaderSource}
                  />

                  {headerSource === 'FILE' && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="template-header-file">
                        {t('form.cabecalho.arquivo')}
                      </Label>
                      <Input
                        id="template-header-file"
                        type="file"
                        accept={HEADER_IMAGE_TYPES.join(',')}
                        onChange={e =>
                          setHeaderImageFile(e.target.files?.[0] ?? null)
                        }
                        aria-describedby="template-header-hint"
                      />
                    </div>
                  )}
                  {headerSource === 'LINK' && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="template-header-url">
                        {t('form.cabecalho.exemplo')}
                      </Label>
                      <Input
                        id="template-header-url"
                        type="url"
                        value={headerImageUrl}
                        placeholder="https://..."
                        onChange={e => setHeaderImageUrl(e.target.value)}
                        aria-describedby="template-header-hint"
                      />
                    </div>
                  )}
                  <span
                    id="template-header-hint"
                    className={`text-xs ${
                      headerTouched && headerViolation
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {headerTouched && headerViolation
                      ? t(`form.cabecalho.erros.${headerViolation}`)
                      : t(
                          headerSource === 'KEEP'
                            ? 'form.cabecalho.manterHint'
                            : headerSource === 'FILE'
                              ? 'form.cabecalho.arquivoHint'
                              : 'form.cabecalho.exemploHint',
                        )}
                  </span>
                </div>
              )}
            </FormSection>
          )}

          <FormSection title={t('form.secaoMensagem')}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-body">{t('form.body')}</Label>
              <textarea
                id="template-body"
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                placeholder={t('form.bodyPlaceholder')}
                aria-describedby="template-body-hint"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <span
                id="template-body-hint"
                className="text-xs text-muted-foreground"
              >
                {t('form.bodyHint')}
              </span>
            </div>

            {variables.length > 0 && (
              <div className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3">
                <span className="text-xs text-muted-foreground">
                  {t('form.exemploHint')}
                </span>
                {variables.map(v => (
                  <div key={v} className="flex flex-col gap-2">
                    <Label htmlFor={`template-example-${v}`}>
                      {t('form.exemplo', { variavel: `{{${v}}}` })}
                    </Label>
                    <Input
                      id={`template-example-${v}`}
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
              <Label htmlFor="template-footer">{t('form.footer')}</Label>
              <Input
                id="template-footer"
                type="text"
                value={footer}
                onChange={e => setFooter(e.target.value)}
              />
            </div>
          </FormSection>

          <TemplateButtonsEditor
            buttons={buttons}
            category={category}
            violations={showButtonErrors ? buttonViolations : []}
            onChange={setButtons}
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {saving
                ? t('form.enviando')
                : editing
                  ? t('form.salvarEdicao')
                  : t('form.enviar')}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('form.cancelar')}
            </Button>
            {(localError || error) && (
              <span role="alert" className="text-sm text-destructive">
                {localError ?? error}
              </span>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t('preview.titulo')}
          </h3>
          <TemplatePreview
            header={
              header === 'IMAGE' && headerAllowed(category) ? 'IMAGE' : 'NONE'
            }
            imageUrl={headerPreviewUrl}
            body={body}
            footer={footer}
            buttons={buttons.map(button => ({
              type: button.type,
              text: 'text' in button ? button.text : undefined,
            }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t('preview.hint')}
          </p>
        </aside>
      </div>
    </div>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** Escolha curta entre poucas opções, como trilho segmentado. */
function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-9 w-fit max-w-full items-center rounded-lg bg-muted p-1"
    >
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`h-7 rounded-md px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            value === option
              ? 'bg-background font-medium text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
