'use client'

export type WidgetButtonType = 'REPLY' | 'URL' | 'CALL'

export type WidgetButtonEntry = {
  /** Só chave de lista/React — o payload de envio não carrega este id junto do tipo REPLY. */
  id: string
  label: string
  type: WidgetButtonType
  /** URL para `type: 'URL'`, telefone para `type: 'CALL'`. Vazio para `REPLY`. */
  value: string
}

const BUTTON_TYPE_LABEL: Record<WidgetButtonType, string> = {
  REPLY: 'Resposta rápida',
  URL: 'Link',
  CALL: 'Ligação',
}

let nextEntryId = 1

/** Só a key do React — o backend nunca lê este id. */
export const newWidgetButtonEntry = (
  type: WidgetButtonType,
): WidgetButtonEntry => ({
  id: `btn-${nextEntryId++}`,
  label: '',
  type,
  value: '',
})

/**
 * Teto de botões por envio, em qualquer linha — espelha
 * `MAX_BUTTONS_PER_SEND` do backend. Linhas com limite próprio menor (a
 * oficial) passam `maxButtons`, que prevalece.
 */
export const MAX_WIDGET_BUTTONS = 5

/**
 * Acrescenta um botão vazio do tipo pedido. `REPLY` não convive com
 * `URL`/`CALL` no mesmo envio — só a troca de família reinicia a lista; outro
 * botão da mesma família é acumulado, preservando o que já foi digitado.
 */
export function appendWidgetButton(
  previous: WidgetButtonEntry[],
  type: WidgetButtonType,
): WidgetButtonEntry[] {
  const hasReply = previous.some(button => button.type === 'REPLY')
  const switchingKind = previous.length > 0 && hasReply !== (type === 'REPLY')

  return switchingKind
    ? [newWidgetButtonEntry(type)]
    : [...previous, newWidgetButtonEntry(type)]
}

/**
 * O que ainda falta para o envio de botões poder ser feito. Mirror de
 * `hasAllTemplateVariables`: usado tanto para habilitar o Enviar quanto para
 * a mensagem exibida acima do formulário.
 *
 * `maxButtons` só a linha oficial define (`1`): a Cloud API da Meta não
 * combina múltiplos botões de URL numa mensagem de sessão livre — confirmado
 * contra a API real em 2026-09-15. Sem ele vale `MAX_WIDGET_BUTTONS`.
 */
export function buttonComposerValidationMessage(
  body: string,
  buttons: WidgetButtonEntry[],
  allowedTypes: WidgetButtonType[],
  maxButtons: number = MAX_WIDGET_BUTTONS,
): string | null {
  if (!body.trim()) return 'Escreva o corpo da mensagem.'
  if (buttons.length === 0) return 'Adicione ao menos um botão.'

  if (buttons.length > maxButtons) {
    return `Esta linha aceita no máximo ${maxButtons} botão(ões) por envio.`
  }

  const invalidType = buttons.find(
    button => !allowedTypes.includes(button.type),
  )
  if (invalidType) {
    return `Esta linha não aceita botão do tipo "${BUTTON_TYPE_LABEL[invalidType.type]}" — troque de linha ou remova o botão.`
  }

  const hasReply = buttons.some(button => button.type === 'REPLY')
  const hasOther = buttons.some(button => button.type !== 'REPLY')
  if (hasReply && hasOther) {
    return 'Não é possível combinar botão de resposta rápida com link/ligação no mesmo envio.'
  }

  const missingLabel = buttons.find(button => !button.label.trim())
  if (missingLabel) return 'Preencha o texto de todos os botões.'

  const missingUrl = buttons.find(
    button => button.type === 'URL' && !button.value.trim(),
  )
  if (missingUrl) return 'Preencha o link de todos os botões de link.'

  const missingPhone = buttons.find(
    button => button.type === 'CALL' && !button.value.trim(),
  )
  if (missingPhone) return 'Preencha o telefone de todos os botões de ligação.'

  return null
}

export type WidgetButtonPayload =
  | { id: string; label: string; type: 'REPLY' }
  | { id: string; label: string; type: 'URL'; url: string }
  | { id: string; label: string; type: 'CALL'; phone: string }

/** O formato que `POST /thinkzap/messages/send-widget-button` espera. */
export function toButtonPayload(
  button: WidgetButtonEntry,
): WidgetButtonPayload {
  if (button.type === 'URL') {
    return {
      id: button.id,
      label: button.label,
      type: 'URL',
      url: button.value,
    }
  }
  if (button.type === 'CALL') {
    return {
      id: button.id,
      label: button.label,
      type: 'CALL',
      phone: button.value,
    }
  }
  return { id: button.id, label: button.label, type: 'REPLY' }
}

type ButtonComposerProps = {
  body: string
  onChangeBody: (value: string) => void
  header: string
  onChangeHeader: (value: string) => void
  footer: string
  onChangeFooter: (value: string) => void
  buttons: WidgetButtonEntry[]
  /** Tipos que a linha selecionada aceita — `HUBMESSAGE`: só URL; `ZAPI`: os três. */
  allowedTypes: WidgetButtonType[]
  /** Máximo de botões por envio — só a linha oficial define (`1`); sem ele vale `MAX_WIDGET_BUTTONS`. */
  maxButtons?: number
  onAddButton: (type: WidgetButtonType) => void
  onUpdateButton: (id: string, patch: Partial<WidgetButtonEntry>) => void
  onRemoveButton: (id: string) => void
  disabled: boolean
}

/**
 * Composição de botões — o modo do widget que o operador ativa explicitamente,
 * disponível para qualquer provider (ao contrário do modo template, que só
 * existe na linha oficial). Mirror de `TemplateComposer`: estado no pai, aqui
 * só o que renderiza.
 */
export const ButtonComposer = ({
  body,
  onChangeBody,
  header,
  onChangeHeader,
  footer,
  onChangeFooter,
  buttons,
  allowedTypes,
  maxButtons = MAX_WIDGET_BUTTONS,
  onAddButton,
  onUpdateButton,
  onRemoveButton,
  disabled,
}: ButtonComposerProps) => {
  const hasReply = buttons.some(button => button.type === 'REPLY')
  const atMaxButtons = buttons.length >= maxButtons

  return (
    <div className="mt-4 grid gap-4">
      <label className="grid gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Corpo da mensagem
        </span>
        <textarea
          className="min-h-20 resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          rows={4}
          value={body}
          onChange={event => onChangeBody(event.target.value)}
          placeholder="Digite o corpo da mensagem..."
          disabled={disabled}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Título (opcional)
          </span>
          <input
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            value={header}
            onChange={event => onChangeHeader(event.target.value)}
            disabled={disabled}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rodapé (opcional)
          </span>
          <input
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            value={footer}
            onChange={event => onChangeFooter(event.target.value)}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Botões
          </p>
          <div className="flex flex-wrap gap-2">
            {allowedTypes.map(type => (
              <button
                key={type}
                type="button"
                disabled={
                  disabled ||
                  (hasReply !== (type === 'REPLY') && buttons.length > 0) ||
                  atMaxButtons
                }
                onClick={() => onAddButton(type)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                + {BUTTON_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>

        {allowedTypes.includes('REPLY') ? (
          <p className="mt-2 text-xs text-slate-500">
            Botão de resposta rápida não pode ser combinado com link ou ligação
            no mesmo envio.
          </p>
        ) : null}

        {buttons.length === 0 ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Nenhum botão adicionado.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {buttons.map(button => (
              <div
                key={button.id}
                className="grid gap-2 rounded-xl border border-slate-200 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    {BUTTON_TYPE_LABEL[button.type]}
                    {!allowedTypes.includes(button.type) ? (
                      <span className="ml-2 text-amber-700">
                        (não aceito por esta linha)
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveButton(button.id)}
                    disabled={disabled}
                    className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Remover
                  </button>
                </div>

                <input
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  value={button.label}
                  placeholder="Texto do botão"
                  onChange={event =>
                    onUpdateButton(button.id, { label: event.target.value })
                  }
                  disabled={disabled}
                />

                {button.type === 'URL' ? (
                  <input
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    value={button.value}
                    placeholder="https://…"
                    onChange={event =>
                      onUpdateButton(button.id, { value: event.target.value })
                    }
                    disabled={disabled}
                  />
                ) : null}

                {button.type === 'CALL' ? (
                  <input
                    className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    value={button.value}
                    placeholder="5511999999999"
                    onChange={event =>
                      onUpdateButton(button.id, { value: event.target.value })
                    }
                    disabled={disabled}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
