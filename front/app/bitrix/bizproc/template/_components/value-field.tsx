'use client'

import { useEffect, useRef, useState } from 'react'
import { filterFields } from '../_lib/document-fields'
import type { DocumentField } from '../_lib/placement-bridge'
import { expressionLabel, type FieldValue } from '../_lib/robot-config'

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
 * Separa padrão de personalizado, preservando a ordem que `toDocumentFields` já deu.
 *
 * Grupo vazio não é renderizado: entidade sem campo personalizado não ganha um
 * cabeçalho solto.
 */
function groupFields(
  fields: DocumentField[],
): { label: string; fields: DocumentField[] }[] {
  return [
    { label: 'Campos da entidade', fields: fields.filter(f => !f.custom) },
    { label: 'Campos personalizados', fields: fields.filter(f => f.custom) },
  ].filter(group => group.fields.length > 0)
}

/** O rótulo de uma opção: o id vem junto, porque é ele que fica gravado. */
const optionLabel = (field: DocumentField): string =>
  field.title === field.id ? field.id : `${field.title} — ${field.id}`

type FieldPickerProps = {
  fields: DocumentField[]
  disabled: boolean
  selected?: DocumentField
  onSelect: (id: string) => void
}

/**
 * Escolha do campo da entidade, com busca.
 *
 * Não é `<select>` nem dropdown flutuante, e os dois motivos são do ambiente: entidade
 * de CRM chega a dezenas de campos, e `<select>` nativo não filtra; painel absoluto
 * ficaria **cortado**, porque a altura do iframe é ajustada ao conteúdo e um elemento
 * fora do fluxo não conta na medição. A lista abre em fluxo, e o frame cresce com ela.
 *
 * Começa fechada quando já há campo escolhido: são três desses na tela, e três listas
 * abertas empurrariam a configuração toda para baixo.
 */
const FieldPicker = ({
  fields,
  disabled,
  selected,
  onSelect,
}: FieldPickerProps) => {
  const [open, setOpen] = useState(false)
  /** Foco na busca só quando **o usuário** abriu: senão, três listas disputariam. */
  const [focusSearch, setFocusSearch] = useState(false)
  const [query, setQuery] = useState('')

  const searchRef = useRef<HTMLInputElement>(null)

  const visible = filterFields(fields, query)

  const expand = () => {
    setOpen(true)
    setFocusSearch(true)
  }

  useEffect(() => {
    if (!focusSearch) return

    searchRef.current?.focus()
    setFocusSearch(false)
  }, [focusSearch])

  if (fields.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Campos do documento indisponíveis
      </p>
    )
  }

  // Sem campo escolhido a lista fica aberta: não há o que colapsar, e o próximo passo
  // do usuário é justamente escolher.
  if (!open && selected) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={expand}
        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-800 disabled:bg-slate-50"
      >
        <span>{optionLabel(selected)}</span>
        <span className="text-xs text-indigo-600">Trocar</span>
      </button>
    )
  }

  return (
    <div className="grid gap-1.5 rounded-lg border border-slate-200 p-2">
      <input
        type="text"
        ref={searchRef}
        disabled={disabled}
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={`Pesquisar entre ${fields.length} campos…`}
        aria-label="Pesquisar campo da entidade"
        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />

      {visible.length === 0 ? (
        <p className="px-1 py-2 text-sm text-slate-500">
          Nenhum campo com “{query}”.
        </p>
      ) : (
        <div role="listbox" className="max-h-56 overflow-y-auto">
          {groupFields(visible).map(group => (
            <div key={group.label} role="group" aria-label={group.label}>
              <p className="sticky top-0 bg-white px-1 py-1 text-xs font-medium text-slate-500">
                {group.label}
              </p>
              {group.fields.map(field => (
                <button
                  key={field.id}
                  type="button"
                  role="option"
                  aria-selected={field.id === selected?.id}
                  onClick={() => {
                    onSelect(field.id)
                    setQuery('')
                    setOpen(false)
                  }}
                  className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    field.id === selected?.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {optionLabel(field)}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Um campo da configuração: texto digitado, campo da entidade, ou a expressão que o
 * seletor nativo do Bitrix já tinha gravado — esta última só é exibida e preservada.
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
          {/*
            Terceiro estado sem botão: o valor veio do seletor nativo do Bitrix e esta
            tela não sabe produzir outro igual — pode apontar para retorno de outro
            passo da automação. Só se sai dele escolhendo Texto ou Campo da entidade.
          */}
          {value.mode === 'expression' && (
            <span className="bg-indigo-600 px-2 py-1 text-white">
              Seletor do Bitrix
            </span>
          )}
        </div>
      </div>

      {value.mode === 'expression' && (
        <div className="grid gap-1">
          <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
            {expressionLabel(value.value)}
          </p>
          <p className="text-xs text-slate-500">
            Valor escolhido no seletor do Bitrix — mantido exatamente como está.
            Para trocar, use Texto ou Campo da entidade.
          </p>
        </div>
      )}

      {value.mode === 'literal' && (
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
      )}

      {value.mode === 'document' && (
        <FieldPicker
          fields={fields}
          disabled={disabled}
          selected={selected}
          onSelect={id => onChange({ mode: 'document', value: id })}
        />
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
