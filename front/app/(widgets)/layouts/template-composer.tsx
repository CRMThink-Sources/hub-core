'use client'

import type {
  WidgetTemplate,
  WidgetTemplateButton,
} from '@/app/hooks/use-widget-templates'
import {
  dynamicButtons,
  extractTemplateVariables,
  isHttpsUrl,
  needsHeaderImage,
  resolveTemplatePreview,
} from './template-variables'

type TemplateComposerProps = {
  templates: WidgetTemplate[]
  loading: boolean
  /** Mensagem de falha de carregamento, já legível — vem do servidor quando existe. */
  error: string
  /** Template escolhido, identificado pelo par `name`+`language`. */
  selectedKey: string
  onSelectTemplate: (key: string) => void
  values: Record<string, string>
  onChangeValue: (key: string, value: string) => void
  /** Valores dos botões dinâmicos, pela posição (`index`) do botão no template. */
  buttonValues: Record<number, string>
  onChangeButtonValue: (index: number, value: string) => void
  /** URL da imagem do cabeçalho, em template com cabeçalho de imagem. */
  headerImageUrl: string
  onChangeHeaderImageUrl: (value: string) => void
  disabled: boolean
}

/** Rótulo do botão no preview — copiar código não tem texto próprio. */
const buttonLabel = (button: WidgetTemplateButton): string =>
  button.text || (button.type === 'COPY_CODE' ? 'Copiar código' : 'Botão')

/** O que o campo do botão dinâmico pede ao operador. */
const buttonFieldLabel = (button: WidgetTemplateButton): string =>
  button.type === 'COPY_CODE'
    ? 'Código do cupom'
    : `Final do link "${buttonLabel(button)}"`

/**
 * Chave de seleção do template.
 *
 * `name` sozinho não identifica: a mesma WABA pode ter o template em vários
 * idiomas, e o par é o que o envio manda ao provider. O template não tem id local
 * — o `id` remoto existe, mas a rota do widget não o devolve de propósito.
 */
export const templateKey = (template: WidgetTemplate): string =>
  `${template.name}|${template.language}`

/**
 * Composição de template — o modo do widget quando a linha é do WhatsApp Oficial.
 *
 * Componente próprio e não mais um bloco dentro de `conversation-view.tsx`: aquele
 * arquivo já passa de 700 linhas, e o modo template tem estado, derivação e lista
 * próprios. O estado mora no pai (é ele que envia); aqui só entra o que renderiza.
 *
 * Sem i18n, como o resto do widget: os textos são literais em português.
 */
export const TemplateComposer = ({
  templates,
  loading,
  error,
  selectedKey,
  onSelectTemplate,
  values,
  onChangeValue,
  buttonValues,
  onChangeButtonValue,
  headerImageUrl,
  onChangeHeaderImageUrl,
  disabled,
}: TemplateComposerProps) => {
  const selected = templates.find(
    template => templateKey(template) === selectedKey,
  )
  const showHeaderImage = needsHeaderImage(selected)
  const headerImageValid = isHttpsUrl(headerImageUrl)
  const variables = selected ? extractTemplateVariables(selected.body) : []
  const buttonFields = dynamicButtons(selected?.buttons)

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-3">
        <p className="text-sm font-medium text-blue-900">
          Linha do WhatsApp Oficial
        </p>
        <p className="mt-1 text-sm text-blue-900">
          O envio é feito por template aprovado. Mensagem livre e anexos não
          estão disponíveis nesta linha.
        </p>
      </div>

      {/*
        Falha de carregamento vira aviso e não lista vazia: "nenhum template
        aprovado" e "não deu para carregar" pedem ações diferentes do operador, e
        um texto só para os dois mandaria ele cadastrar template que já existe.
      */}
      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {!error && !loading && templates.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nenhum template aprovado nesta linha. Cadastre e aguarde a aprovação
          da Meta na tela de conexões antes de enviar.
        </p>
      ) : null}

      <label className="group grid min-w-0 gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Template
        </span>
        <select
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition group-focus-within:border-blue-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          value={selectedKey}
          onChange={event => onSelectTemplate(event.target.value)}
          disabled={disabled || loading || templates.length === 0}
        >
          <option value="">
            {loading ? 'Carregando templates...' : 'Selecione um template'}
          </option>
          {templates.map(template => (
            <option key={templateKey(template)} value={templateKey(template)}>
              {template.name} - {template.language}
            </option>
          ))}
        </select>
      </label>

      {selected ? (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-4">
          {showHeaderImage ? (
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Imagem do cabeçalho
              </span>
              <input
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                value={headerImageUrl}
                onChange={event => onChangeHeaderImageUrl(event.target.value)}
                disabled={disabled}
                placeholder="https://..."
                inputMode="url"
              />
              <span
                className={`text-xs ${
                  headerImageUrl && !headerImageValid
                    ? 'text-red-600'
                    : 'text-slate-500'
                }`}
              >
                {headerImageUrl && !headerImageValid
                  ? 'A URL precisa começar com https://'
                  : 'Link público e direto para o arquivo JPEG ou PNG.'}
              </span>
            </label>
          ) : null}

          {variables.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Variáveis
              </p>
              {/*
                Um campo por variável **distinta**: nome repetido no corpo é
                preenchido uma vez só (ver `extractTemplateVariables`).
              */}
              {variables.map(key => (
                <label key={key} className="grid gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    {`{{${key}}}`}
                  </span>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    value={values[key] ?? ''}
                    onChange={event => onChangeValue(key, event.target.value)}
                    disabled={disabled}
                    placeholder={`Valor de {{${key}}}`}
                  />
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Este template não tem variáveis para preencher.
            </p>
          )}

          {buttonFields.length > 0 ? (
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Botões
              </p>
              {buttonFields.map(button => (
                <label key={button.index} className="grid gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    {buttonFieldLabel(button)}
                  </span>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    value={buttonValues[button.index] ?? ''}
                    onChange={event =>
                      onChangeButtonValue(button.index, event.target.value)
                    }
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="grid gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Preview
            </p>
            {/*
              `whitespace-pre-wrap` porque o corpo aprovado pode ter quebra de
              linha, e é exatamente assim que o contato vai receber.
            */}
            {showHeaderImage ? (
              headerImageValid ? (
                <img
                  src={headerImageUrl.trim()}
                  alt="Imagem do cabeçalho"
                  className="max-h-48 w-full rounded-xl bg-slate-100 object-cover"
                />
              ) : (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                  Imagem do cabeçalho
                </div>
              )
            ) : null}
            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">
              {resolveTemplatePreview(selected.body, values)}
            </p>
            {selected.buttons?.length ? (
              <div className="mt-1 flex flex-wrap gap-2">
                {selected.buttons.map(button => (
                  <span
                    key={button.index}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700"
                  >
                    {buttonLabel(button)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
