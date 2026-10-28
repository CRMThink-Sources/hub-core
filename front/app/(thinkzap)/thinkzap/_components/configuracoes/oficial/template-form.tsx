'use client'

import { ArrowLeft, Braces, Eye } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  TEMPLATE_BUTTON_LIMITS,
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
import {
  categoryLocked,
  firstMissingKey,
  formInitialOf,
  insertNextVariable,
  TEMPLATE_TEXT_LIMITS,
} from './template-view'

const CATEGORIES: TemplateCategory[] = [
  'MARKETING',
  'UTILITY',
  'AUTHENTICATION',
]
const LANGUAGES = ['pt_BR', 'en_US', 'es_ES']
const NAME_REGEX = /^[a-z0-9_]+$/
const VAR_REGEX = /\{\{\s*(\d+)\s*\}\}/g

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-70'

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
 * Criação e edição de template, em painéis na ordem em que a mensagem é lida
 * (identificação, cabeçalho, mensagem, botões), com a prévia ao lado.
 *
 * O layout segue a largura do próprio formulário (`@container`), não a da janela:
 * dentro do slider do Bitrix24 a janela é larga e o espaço do formulário, não. Sem
 * espaço para duas colunas, a prévia vira um painel que abre e fecha no topo.
 *
 * Na edição, nome e idioma não mudam (regra da Meta), a categoria trava em
 * template aprovado, e a imagem pode ser mantida — a API manda a imagem padrão do
 * envio como amostra.
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
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<TemplateCategory>(
    initial?.category ?? 'MARKETING',
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
  const missingKey = firstMissingKey({
    nameValid,
    body,
    examplesFilled,
    headerViolation,
  })
  const canSubmit = missingKey === null && !saving

  /** Insere a próxima variável onde está o cursor e devolve o foco ao corpo. */
  const addVariable = () => {
    const field = bodyRef.current
    const next = insertNextVariable(body, field?.selectionStart ?? body.length)
    if (next.text.length > TEMPLATE_TEXT_LIMITS.body) return
    setBody(next.text)
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(next.cursor, next.cursor)
    })
  }

  const handleSubmit = async () => {
    setLocalError(null)
    create.setError(null)
    update.setError(null)
    if (missingKey) {
      setLocalError(t(missingKey))
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

  const preview = (
    <TemplatePreview
      header={header === 'IMAGE' && headerAllowed(category) ? 'IMAGE' : 'NONE'}
      imageUrl={headerPreviewUrl}
      body={body}
      footer={footer}
      buttons={buttons.map(button => ({
        type: button.type,
        text: 'text' in button ? button.text : undefined,
      }))}
    />
  )

  return (
    <div className="@container flex max-w-[68rem] flex-col gap-5">
      <div className="flex items-start gap-3">
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

      {/* Sem espaço para duas colunas: a prévia abre e fecha no topo. */}
      <details className="group rounded-lg border border-border @4xl:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <Eye className="size-4 text-muted-foreground" aria-hidden />
          <span className="group-open:hidden">{t('form.verPrevia')}</span>
          <span className="hidden group-open:inline">
            {t('form.esconderPrevia')}
          </span>
        </summary>
        <div className="px-4 pb-4">{preview}</div>
      </details>

      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title={t('form.secaoIdentificacao')}
            description={t('form.secaoIdentificacaoDesc')}
          >
            <div className="grid gap-4 @xl:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-name">{t('form.nome')}</Label>
                <Input
                  id="template-name"
                  type="text"
                  value={name}
                  placeholder="promo_natal"
                  disabled={editing}
                  maxLength={512}
                  onChange={e => setName(e.target.value.toLowerCase())}
                  aria-describedby="template-name-hint"
                />
                <span
                  id="template-name-hint"
                  className={`text-xs ${name && !nameValid ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {editing ? t('form.nomeTravado') : t('form.nomeHint')}
                </span>
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

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium text-foreground">
                {t('form.categoria')}
              </legend>
              <div
                role="radiogroup"
                aria-label={t('form.categoria')}
                className="grid gap-2 @xl:grid-cols-3"
              >
                {CATEGORIES.map(option => {
                  const selected = category === option
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={lockCategory && !selected}
                      onClick={() => changeCategory(option)}
                      className={`flex flex-col gap-0.5 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? 'border-foreground bg-muted/60'
                          : 'border-input hover:bg-muted/40'
                      }`}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {t(`categoria.${option}`)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(`form.categoriaDesc.${option}`)}
                      </span>
                    </button>
                  )
                })}
              </div>
              {lockCategory && (
                <span className="text-xs text-muted-foreground">
                  {t('form.categoriaTravada')}
                </span>
              )}
            </fieldset>
          </Panel>

          <Panel
            title={t('form.cabecalho.titulo')}
            description={t('form.secaoCabecalhoDesc')}
          >
            {headerAllowed(category) ? (
              <>
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
                  <div className="flex flex-col gap-3 rounded-md bg-muted/60 p-3">
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
                          className="bg-background"
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
                          className="bg-background"
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('form.cabecalho.erros.header_not_allowed')}
              </p>
            )}
          </Panel>

          <Panel
            title={t('form.secaoMensagem')}
            description={t('form.secaoMensagemDesc')}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between gap-2">
                <Label htmlFor="template-body">{t('form.body')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariable}
                >
                  <Braces className="size-3.5" aria-hidden />
                  {t('form.inserirVariavel')}
                </Button>
              </div>
              <textarea
                id="template-body"
                ref={bodyRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                maxLength={TEMPLATE_TEXT_LIMITS.body}
                placeholder={t('form.bodyPlaceholder')}
                aria-describedby="template-body-hint"
                className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed"
              />
              <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                <span id="template-body-hint">{t('form.bodyHint')}</span>
                <Counter value={body.length} max={TEMPLATE_TEXT_LIMITS.body} />
              </div>
            </div>

            {variables.length > 0 && (
              <div className="flex flex-col gap-3 rounded-md bg-muted/60 p-3">
                <span className="text-xs text-muted-foreground">
                  {t('form.exemploHint')}
                </span>
                <div className="grid gap-3 @xl:grid-cols-2">
                  {variables.map(v => (
                    <div key={v} className="flex flex-col gap-2">
                      <Label htmlFor={`template-example-${v}`}>
                        {t('form.exemplo', { variavel: `{{${v}}}` })}
                      </Label>
                      <Input
                        id={`template-example-${v}`}
                        type="text"
                        value={examples[v] ?? ''}
                        className="bg-background"
                        placeholder={t('form.exemploPlaceholder', {
                          variavel: `{{${v}}}`,
                        })}
                        onChange={e =>
                          setExamples(prev => ({
                            ...prev,
                            [v]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="template-footer">{t('form.footer')}</Label>
              <Input
                id="template-footer"
                type="text"
                value={footer}
                maxLength={TEMPLATE_TEXT_LIMITS.footer}
                onChange={e => setFooter(e.target.value)}
              />
              <div className="flex justify-end text-xs text-muted-foreground">
                <Counter
                  value={footer.length}
                  max={TEMPLATE_TEXT_LIMITS.footer}
                />
              </div>
            </div>
          </Panel>

          {allowedButtonTypes(category).length > 0 && (
            <Panel
              title={t('form.botoes.titulo')}
              description={t('form.botoes.hint', {
                max: TEMPLATE_BUTTON_LIMITS.total,
              })}
            >
              <TemplateButtonsEditor
                buttons={buttons}
                category={category}
                violations={showButtonErrors ? buttonViolations : []}
                onChange={setButtons}
                showHeader={false}
              />
            </Panel>
          )}
        </div>

        <aside className="hidden @4xl:sticky @4xl:top-4 @4xl:block @4xl:self-start">
          <h3 className="mb-2 text-sm font-medium text-foreground">
            {t('preview.titulo')}
          </h3>
          {preview}
          <p className="mt-2 text-xs text-muted-foreground">
            {t('preview.hint')}
          </p>
        </aside>
      </div>

      {/* Fica à vista no slider: o formulário é mais alto que a tela. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 border-t border-border bg-background px-1 py-3 @xl:flex-row @xl:items-center @xl:justify-between">
        <span
          role={localError || error ? 'alert' : undefined}
          className={`text-sm ${localError || error ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {(localError ?? error) ||
            (missingKey ? t(missingKey) : t('form.pronto'))}
        </span>
        <div className="flex flex-none items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('form.cancelar')}
          </Button>
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
        </div>
      </div>
    </div>
  )
}

/** Painel de uma seção: título e uma linha do que ela define. */
function Panel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 @xl:p-5">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

/** Contador de caracteres; perto do limite fica no tom de aviso. */
function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={`flex-none tabular-nums ${value > max * 0.9 ? 'text-amber-700 dark:text-amber-400' : ''}`}
    >
      {value}/{max}
    </span>
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
      className="inline-flex h-9 w-fit max-w-full items-center overflow-x-auto rounded-lg bg-muted p-1"
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
