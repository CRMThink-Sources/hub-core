'use client'

import type { DocumentField } from '../_lib/placement-bridge'
import type { FieldValue } from '../_lib/robot-config'

type ValueFieldProps = {
  label: string
  hint?: string
  value: FieldValue
  fields: DocumentField[]
  disabled?: boolean
  placeholder?: string
  onChange: (value: FieldValue) => void
}

/**
 * Um campo da configuração: texto digitado **ou** campo da entidade.
 *
 * É o que o formulário nativo do Bitrix dá de graça e que uma tela própria teria de
 * devolver — sem isso, automação só serviria para mandar template com valores fixos,
 * que é justamente o que ninguém automatiza.
 *
 * Sem i18n, como o resto das telas de Bitrix: os textos são literais em português.
 */
export const ValueField = ({
  label,
  hint,
  value,
  fields,
  disabled = false,
  placeholder,
  onChange,
}: ValueFieldProps) => {
  const selected = fields.find(field => field.id === value.value)

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-800">{label}</label>
        <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ mode: 'literal', value: '' })}
            className={
              value.mode === 'literal'
                ? 'bg-indigo-600 px-2 py-1 text-white'
                : 'bg-white px-2 py-1 text-slate-600'
            }
          >
            Texto
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ mode: 'document', value: '' })}
            className={
              value.mode === 'document'
                ? 'bg-indigo-600 px-2 py-1 text-white'
                : 'bg-white px-2 py-1 text-slate-600'
            }
          >
            Campo da entidade
          </button>
        </div>
      </div>

      {value.mode === 'literal' ? (
        <input
          type="text"
          disabled={disabled}
          value={value.value}
          placeholder={placeholder}
          onChange={event =>
            onChange({ mode: 'literal', value: event.target.value })
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        />
      ) : (
        <select
          disabled={disabled || fields.length === 0}
          value={value.value}
          onChange={event =>
            onChange({ mode: 'document', value: event.target.value })
          }
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">
            {fields.length === 0
              ? 'Campos do documento indisponíveis'
              : 'Escolha o campo…'}
          </option>
          {fields.map(field => (
            <option key={field.id} value={field.id}>
              {field.title}
            </option>
          ))}
        </select>
      )}

      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      {/*
        O Bitrix resolve o campo antes de chamar o handler, e campo múltiplo chega
        concatenado. Avisar aqui é a única chance: depois do disparo não há como
        distinguir um valor de vários.
      */}
      {selected?.multiple && (
        <p className="text-xs text-amber-700">
          Este campo aceita vários valores — eles chegam juntos, num texto só.
        </p>
      )}
    </div>
  )
}
