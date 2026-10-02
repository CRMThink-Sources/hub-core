'use client'

import { useEffect, useState } from 'react'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import {
  fetchDocumentFields,
  setPropertyValue,
  type DocumentField,
  type PlacementContext,
} from '../template/_lib/placement-bridge'
import { ValueField } from '../template/_components/value-field'
import {
  buildButtonRobotProperties,
  MAX_ROBOT_BUTTONS,
  newButtonEntry,
  parseStoredButtonProperties,
  validateButtonConfig,
  type ButtonEntry,
  type ButtonRobotConfigState,
  type ButtonType,
} from './button-robot-config'

type ButtonLine = { id: string; name: string }

const toFieldIds = (fields: DocumentField[]): ReadonlySet<string> =>
  new Set(fields.map(field => field.id))

const BUTTON_TYPE_LABEL: Record<ButtonType, string> = {
  REPLY: 'Resposta rápida',
  URL: 'Link',
  CALL: 'Ligação',
}

type ButtonRobotFormProps = {
  context: PlacementContext
  /** Tipos de botão que este robô aceita — o que muda entre oficial e não oficial. */
  allowedTypes: ButtonType[]
  /**
   * Máximo de botões por envio, por tipo. Só o oficial define: a Cloud API
   * da Meta aceita um único botão `URL`, mas até 3 `REPLY`, numa mensagem de
   * sessão livre.
   */
  maxButtonsByType?: Partial<Record<ButtonType, number>>
  /** Rota de linhas elegíveis para este robô (uma por provider). */
  linesEndpoint: string
  /** Rótulo do seletor de linha — nome do provider deste robô. */
  lineLabel: string
}

/**
 * A configuração dos dois robôs de botão, compartilhada entre o oficial e o
 * não oficial — só `allowedTypes`/`linesEndpoint`/`lineLabel` divergem.
 *
 * Mesmo padrão da tela de template: gravação incremental via
 * `setPropertyValue`, sem botão de aplicar — quem persiste é o salvar do
 * próprio slider do Bitrix.
 */
export const ButtonRobotForm = ({
  context,
  allowedTypes,
  maxButtonsByType,
  linesEndpoint,
  lineLabel,
}: ButtonRobotFormProps) => {
  const [documentFields, setDocumentFields] = useState<DocumentField[]>(
    context.documentFields,
  )

  const [config, setConfig] = useState<ButtonRobotConfigState>(() =>
    parseStoredButtonProperties(
      context.storedProperties,
      toFieldIds(context.documentFields),
    ),
  )

  const [lines, setLines] = useState<ButtonLine[]>([])
  const [linesError, setLinesError] = useState('')
  const [linesLoading, setLinesLoading] = useState(true)

  const update = (next: ButtonRobotConfigState) => {
    setConfig(next)
    setPropertyValue(buildButtonRobotProperties(next))
  }

  useEffect(() => {
    if (context.documentFields.length > 0) return

    void fetchDocumentFields(context.documentType).then(fields => {
      if (fields.length === 0) return

      setDocumentFields(fields)
      setConfig(current =>
        parseStoredButtonProperties(
          buildButtonRobotProperties(current),
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
      .get<{ lines: ButtonLine[] }>(linesEndpoint)
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
  }, [linesEndpoint])

  const savedLineMissing = Boolean(
    config.connector &&
    !linesLoading &&
    !lines.some(line => line.id === config.connector),
  )

  const hasReply = config.buttons.some(button => button.type === 'REPLY')

  const addButton = (type: ButtonType) => {
    /** REPLY não convive com os outros dois no mesmo envio — só troca de tipo reinicia a lista. */
    const switchingKind =
      config.buttons.length > 0 && hasReply !== (type === 'REPLY')

    const nextButtons = switchingKind
      ? [newButtonEntry(type)]
      : [...config.buttons, newButtonEntry(type)]

    update({ ...config, buttons: nextButtons })
  }

  const updateButton = (id: string, patch: Partial<ButtonEntry>) => {
    update({
      ...config,
      buttons: config.buttons.map(button =>
        button.id === id ? { ...button, ...patch } : button,
      ),
    })
  }

  const removeButton = (id: string) => {
    update({
      ...config,
      buttons: config.buttons.filter(button => button.id !== id),
    })
  }

  const missing = validateButtonConfig(config, allowedTypes, maxButtonsByType)

  const isTypeAtMax = (type: ButtonType) => {
    const max = maxButtonsByType?.[type] ?? MAX_ROBOT_BUTTONS
    return config.buttons.length >= max
  }

  return (
    <div className="grid gap-5 p-4">
      <section className="grid gap-1.5">
        <label className="text-sm font-medium text-slate-800">
          {lineLabel}
        </label>
        <select
          value={config.connector}
          disabled={linesLoading || lines.length === 0}
          onChange={event =>
            update({ ...config, connector: event.target.value })
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
            Nenhuma linha elegível nesta instalação para este robô.
          </p>
        )}

        {savedLineMissing && (
          <p className="text-xs text-amber-700">
            A linha configurada não está mais disponível para este robô. Escolha
            outra linha.
          </p>
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
          <span>Enviar para todos os contatos relacionados</span>
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

      <section className="grid gap-3">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-slate-800">
            Corpo da mensagem
          </label>
          <textarea
            value={config.body}
            onChange={event => update({ ...config, body: event.target.value })}
            rows={3}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-slate-800">
            Título (opcional)
          </label>
          <input
            type="text"
            value={config.header}
            onChange={event =>
              update({ ...config, header: event.target.value })
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-slate-800">
            Rodapé (opcional)
          </label>
          <input
            type="text"
            value={config.footer}
            onChange={event =>
              update({ ...config, footer: event.target.value })
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Botões</h2>
          <div className="flex gap-1.5">
            {allowedTypes.map(type => (
              <button
                key={type}
                type="button"
                disabled={
                  (hasReply !== (type === 'REPLY') &&
                    config.buttons.length > 0) ||
                  isTypeAtMax(type)
                }
                onClick={() => addButton(type)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                + {BUTTON_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>

        {allowedTypes.includes('REPLY') && (
          <p className="text-xs text-slate-500">
            Botão de resposta rápida não pode ser combinado com link ou ligação
            no mesmo envio.
          </p>
        )}

        {config.buttons.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Nenhum botão adicionado.
          </p>
        )}

        {config.buttons.map(button => (
          <div
            key={button.id}
            className="grid gap-2 rounded-lg border border-slate-200 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                {BUTTON_TYPE_LABEL[button.type]}
              </span>
              <button
                type="button"
                onClick={() => removeButton(button.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remover
              </button>
            </div>

            <input
              type="text"
              value={button.label}
              placeholder="Texto do botão"
              onChange={event =>
                updateButton(button.id, { label: event.target.value })
              }
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />

            {button.type === 'URL' && (
              <input
                type="text"
                value={button.value}
                placeholder="https://…"
                onChange={event =>
                  updateButton(button.id, { value: event.target.value })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            )}

            {button.type === 'CALL' && (
              <input
                type="text"
                value={button.value}
                placeholder="5511999999999"
                onChange={event =>
                  updateButton(button.id, { value: event.target.value })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
      </section>

      {missing && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {missing}
        </p>
      )}
    </div>
  )
}
