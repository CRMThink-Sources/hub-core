'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import {
  dynamicButtons,
  extractTemplateVariables,
  resolveTemplatePreview,
} from '@/app/(widgets)/layouts/template-variables'
import {
  fetchDocumentFields,
  setPropertyValue,
  type DocumentField,
  type PlacementContext,
} from '../_lib/placement-bridge'
import {
  buildRobotProperties,
  parseStoredProperties,
  rebuildButtonValues,
  rebuildValues,
  templateKey,
  toStoredValue,
  validateConfig,
  type FieldValue,
  type RobotConfigState,
  type TemplateChoice,
} from '../_lib/robot-config'
import { ValueField } from './value-field'

type TemplateLine = { id: string; name: string }

/** Ids dos campos do documento, para o parse derivar o modo de valor sem expressão. */
const toFieldIds = (fields: DocumentField[]): ReadonlySet<string> =>
  new Set(fields.map(field => field.id))

type TemplateRobotFormProps = {
  context: PlacementContext
}

/**
 * A configuração do robô de template, no lugar do formulário nativo.
 *
 * O que a tela existe para resolver: o formulário nativo só renderiza opções
 * estáticas, então ele não consegue listar os templates aprovados da WABA daquela
 * linha nem derivar um campo por variável do corpo. Sem isso, configurar o envio
 * seria digitar o nome do template e os parâmetros posicionais de cabeça.
 *
 * A gravação é incremental — cada mudança escreve as propriedades pelo placement — e
 * quem persiste é o botão de salvar do próprio slider do Bitrix.
 */
export const TemplateRobotForm = ({ context }: TemplateRobotFormProps) => {
  /**
   * Os campos do documento começam nos que o placement já entregou. Só isso permite
   * parsear o estado inicial conhecendo os ids: um valor gravado que volte sem a
   * expressão, só com o id do campo, seria indistinguível de texto digitado.
   */
  const [documentFields, setDocumentFields] = useState<DocumentField[]>(
    context.documentFields,
  )

  const [config, setConfig] = useState<RobotConfigState>(() =>
    parseStoredProperties(
      context.storedProperties,
      toFieldIds(context.documentFields),
    ),
  )

  const [lines, setLines] = useState<TemplateLine[]>([])
  const [linesError, setLinesError] = useState('')
  const [linesLoading, setLinesLoading] = useState(true)

  const [templates, setTemplates] = useState<TemplateChoice[]>([])
  const [templatesError, setTemplatesError] = useState('')
  const [templatesLoading, setTemplatesLoading] = useState(false)

  /** Toda mudança de estado reescreve as propriedades — sem botão de aplicar. */
  const update = (next: RobotConfigState) => {
    setConfig(next)
    setPropertyValue(buildRobotProperties(next))
  }

  /**
   * Reserva: portal que não manda `document_fields` cai no método REST da entidade.
   *
   * Quando ela responde, o estado é reparseado com os ids em mão — é a chance de um
   * valor que abriu como texto voltar para o modo campo. `setPropertyValue` **não** é
   * chamado aqui: reparsear não é edição do usuário, e gravar sem ele ter mexido em
   * nada sujaria a configuração do robô só por abrir a tela.
   */
  useEffect(() => {
    if (context.documentFields.length > 0) return

    void fetchDocumentFields(context.documentType).then(fields => {
      if (fields.length === 0) return

      setDocumentFields(fields)
      setConfig(current =>
        parseStoredProperties(
          buildRobotProperties(current),
          toFieldIds(fields),
        ),
      )
    })
  }, [context.documentType, context.documentFields])

  useEffect(() => {
    const client = resolveThinkzapClient()
    if (!client.ok) {
      setLinesError(client.message)
      setLinesLoading(false)
      return
    }

    let cancelled = false

    void client.client
      .get<{ lines: TemplateLine[] }>('/thinkzap/messages/template-lines')
      .then(response => {
        if (cancelled) return
        setLines(response.lines)
        setLinesLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLinesError(
          thinkzapApiErrorMessage(
            error,
            'Não foi possível carregar as linhas desta instalação.',
          ),
        )
        setLinesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!config.connector) {
      setTemplates([])
      return
    }

    const client = resolveThinkzapClient()
    if (!client.ok) {
      setTemplatesError(client.message)
      return
    }

    let cancelled = false
    setTemplatesLoading(true)
    setTemplatesError('')

    void client.client
      .get<{
        templates: TemplateChoice[]
      }>(
        `/thinkzap/messages/widget-templates/${encodeURIComponent(config.connector)}`,
      )
      .then(response => {
        if (cancelled) return
        setTemplates(response.templates)
        setTemplatesLoading(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        /**
         * A mensagem do servidor é preservada: é ela que distingue "conclua a conexão
         * do número" de "esta linha não tem templates aprovados". Um texto genérico
         * mandaria o usuário procurar no lugar errado.
         *
         * O que já estava configurado **não** é apagado: a falha é de leitura, e
         * perder a configuração por causa dela seria um estrago desproporcional.
         */
        setTemplates([])
        setTemplatesLoading(false)
        setTemplatesError(
          thinkzapApiErrorMessage(
            error,
            'Não foi possível carregar os templates desta linha.',
          ),
        )
      })

    return () => {
      cancelled = true
    }
  }, [config.connector])

  const selectedKey = config.template ? templateKey(config.template) : ''

  /**
   * Linha salva que sumiu da lista: assinatura vencida, canal desconectado, ou linha
   * removida. Sinalizada em vez de apagada — apagar em silêncio faria a automação
   * parecer configurada quando não está mais.
   */
  const savedLineMissing = Boolean(
    config.connector &&
    !linesLoading &&
    !lines.some(line => line.id === config.connector),
  )

  const variables = useMemo(
    () => extractTemplateVariables(config.template?.body ?? ''),
    [config.template],
  )

  const preview = resolveTemplatePreview(
    config.template?.body ?? '',
    Object.fromEntries(
      Object.entries(config.values).map(([key, field]) => [
        key,
        toStoredValue(field),
      ]),
    ),
  )

  /**
   * Os botões vêm do catálogo carregado, não do gravado: o robô só guarda os valores.
   * Enquanto o catálogo não chega, a tela não mostra nem confere campos de botão.
   */
  const catalogTemplate = templates.find(
    item => templateKey(item) === selectedKey,
  )
  const buttonFields = dynamicButtons(catalogTemplate?.buttons)

  const missing = validateConfig(
    config,
    catalogTemplate ? buttonFields.length : undefined,
  )

  return (
    <div className="grid gap-5 p-4">
      <section className="grid gap-1.5">
        <label className="text-sm font-medium text-slate-800">
          Linha do WhatsApp Oficial
        </label>
        <select
          value={config.connector}
          disabled={linesLoading || lines.length === 0}
          onChange={event =>
            update({
              ...config,
              connector: event.target.value,
              template: null,
              values: {},
              buttonValues: [],
            })
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">
            {linesLoading ? 'Carregando linhas…' : 'Escolha a linha…'}
          </option>
          {lines.map(line => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>

        {linesError && <p className="text-xs text-red-600">{linesError}</p>}

        {!linesLoading && !linesError && lines.length === 0 && (
          <p className="text-xs text-amber-700">
            Nenhuma linha do WhatsApp Oficial conectada nesta instalação.
            Conecte uma linha oficial no ThinkZap antes de configurar esta
            automação.
          </p>
        )}

        {savedLineMissing && (
          <p className="text-xs text-amber-700">
            A linha configurada não está mais disponível para envio de template.
            Escolha outra linha.
          </p>
        )}
      </section>

      <section className="grid gap-1.5">
        <label className="text-sm font-medium text-slate-800">Template</label>
        <select
          value={selectedKey}
          disabled={!config.connector || templatesLoading}
          onChange={event => {
            const chosen = templates.find(
              item => templateKey(item) === event.target.value,
            )

            update({
              ...config,
              template: chosen ?? null,
              values: rebuildValues(chosen?.body ?? '', config.values),
              buttonValues: rebuildButtonValues(chosen?.buttons),
            })
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">
            {templatesLoading ? 'Carregando templates…' : 'Escolha o template…'}
          </option>
          {templates.map(item => (
            <option key={templateKey(item)} value={templateKey(item)}>
              {item.name} ({item.language})
            </option>
          ))}
        </select>

        {templatesError && (
          <p className="text-xs text-red-600">{templatesError}</p>
        )}
      </section>

      <section className="grid gap-3 rounded-xl border border-slate-200 p-3">
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={config.sendToAllRelatedContacts}
            onChange={event =>
              update({
                ...config,
                sendToAllRelatedContacts: event.target.checked,
              })
            }
            className="mt-0.5"
          />
          <span>
            Enviar para todos os contatos relacionados
            <span className="mt-0.5 block text-xs text-amber-700">
              Cada destinatário encontrado recebe um template — e cada template
              é cobrado pela Meta.
            </span>
          </span>
        </label>

        <ValueField
          label="Destino"
          hint={
            config.sendToAllRelatedContacts
              ? 'Ignorado enquanto o envio para todos os contatos relacionados estiver ligado.'
              : 'Telefone com DDI e DDD, ou o campo da entidade que guarda o telefone.'
          }
          placeholder="5511999999999"
          value={config.destination}
          fields={documentFields}
          disabled={config.sendToAllRelatedContacts}
          onChange={destination => update({ ...config, destination })}
        />
      </section>

      {variables.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Variáveis do template
          </h2>

          {variables.map(key => (
            <ValueField
              key={key}
              label={`Variável {{${key}}}`}
              value={config.values[key] ?? { mode: 'literal', value: '' }}
              fields={documentFields}
              onChange={(value: FieldValue) =>
                update({
                  ...config,
                  values: { ...config.values, [key]: value },
                })
              }
            />
          ))}
        </section>
      )}

      {buttonFields.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Botões do template
          </h2>

          {buttonFields.map((button, position) => (
            <ValueField
              key={button.index}
              label={
                button.type === 'COPY_CODE'
                  ? 'Código do cupom'
                  : `Final do link "${button.text}"`
              }
              value={
                config.buttonValues[position] ?? { mode: 'literal', value: '' }
              }
              fields={documentFields}
              onChange={(value: FieldValue) => {
                const buttonValues = buttonFields.map(
                  (_, i) =>
                    (i === position ? value : config.buttonValues[i]) ?? {
                      mode: 'literal' as const,
                      value: '',
                    },
                )
                update({ ...config, buttonValues })
              }}
            />
          ))}
        </section>
      )}

      {config.template && (
        <section className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
          <p className="text-xs font-medium text-blue-900">
            Prévia da mensagem
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-blue-950">
            {preview}
          </p>
          {catalogTemplate?.buttons?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {catalogTemplate.buttons.map(button => (
                <span
                  key={button.index}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-medium text-blue-700"
                >
                  {button.text ||
                    (button.type === 'COPY_CODE' ? 'Copiar código' : 'Botão')}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {missing && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {missing}
        </p>
      )}
    </div>
  )
}
