'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { FlowVar } from '@/shared/thinkzap-flow-vars'

/**
 * Campo de fala do bot. O `@` abre a lista e o texto guarda `{bitrix.name}`, que é o que
 * o motor substitui — digitar a chave na mão erra o namespace e a fala sai com um buraco.
 */
export type TextWithVarsProps = {
  value: string
  onChange: (value: string) => void
  vars: FlowVar[]
  rows?: number
  placeholder?: string
  className?: string
  singleLine?: boolean
}

/** Teto da lista, em px. Também decide se ela abre para cima. */
const LISTA_ALTURA = 160

function queryAtCaret(text: string, caret: number): string | null {
  const antes = text.slice(0, caret)
  const match = /@([a-zA-Z0-9_.]*)$/.exec(antes)
  if (!match) return null

  // `@` colado em palavra é e-mail, não chamada de variável.
  const anterior = antes[match.index - 1] ?? ' '
  return /[\s({[]/.test(anterior) ? (match[1] ?? '') : null
}

export function TextWithVars({
  value,
  onChange,
  vars,
  rows = 3,
  placeholder,
  className = '',
  singleLine = false,
}: TextWithVarsProps) {
  const { t } = useTranslation('thinkzap/bots/bloco')
  const campo = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  const [ativo, setAtivo] = useState(0)
  const [focado, setFocado] = useState(false)

  const filtradas = vars.filter(item =>
    item.name.toLowerCase().includes((query ?? '').toLowerCase()),
  )
  const aberto = query !== null && filtradas.length > 0

  useEffect(() => {
    setAtivo(0)
  }, [query])

  /** Posição da lista, que vai num portal: dentro do painel o scroll a recortava. */
  const [caixa, setCaixa] = useState<{
    left: number
    width: number
    top: number
    acima: boolean
  } | null>(null)

  const medir = useCallback(() => {
    const elemento = campo.current
    if (!elemento) return

    const rect = elemento.getBoundingClientRect()
    const abaixo = window.innerHeight - rect.bottom
    const acima = abaixo < LISTA_ALTURA && rect.top > abaixo

    setCaixa({
      left: rect.left,
      width: rect.width,
      top: acima ? rect.top : rect.bottom,
      acima,
    })
  }, [])

  useLayoutEffect(() => {
    if (!aberto) return

    medir()

    // `true` para capturar o scroll do painel, que não borbulha até a janela.
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)

    return () => {
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
    }
  }, [aberto, medir])

  function atualizar(texto: string, caret: number) {
    onChange(texto)
    setQuery(queryAtCaret(texto, caret))
  }

  function inserir(nome: string) {
    const elemento = campo.current
    const caret = elemento?.selectionStart ?? value.length
    const antes = value.slice(0, caret).replace(/@[a-zA-Z0-9_.]*$/, '')
    const chave = `{${nome}}`

    onChange(`${antes}${chave}${value.slice(caret)}`)
    setQuery(null)

    // No próximo frame: o valor só está no campo depois do repinte.
    requestAnimationFrame(() => {
      const posicao = antes.length + chave.length
      elemento?.focus()
      elemento?.setSelectionRange(posicao, posicao)
    })
  }

  function aoTeclar(event: React.KeyboardEvent) {
    if (!aberto) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const passo = event.key === 'ArrowDown' ? 1 : -1
      setAtivo(atual => (atual + passo + filtradas.length) % filtradas.length)
      return
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      const escolhida = filtradas[ativo]
      if (!escolhida) return
      event.preventDefault()
      inserir(escolhida.name)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setQuery(null)
    }
  }

  const comuns = {
    value,
    placeholder,
    onKeyDown: aoTeclar,
    // O cursor anda sem digitar: a lista acompanha onde ele está.
    onClick: (
      event: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>,
    ) => setQuery(queryAtCaret(value, event.currentTarget.selectionStart ?? 0)),
    onFocus: () => setFocado(true),
    // Fecha depois do clique na lista, senão o item sai de baixo do mouse.
    onBlur: () =>
      requestAnimationFrame(() => {
        setQuery(null)
        setFocado(false)
      }),
    className,
  }

  return (
    <div className="relative flex flex-col gap-1">
      {singleLine ? (
        <input
          {...comuns}
          ref={campo as React.RefObject<HTMLInputElement>}
          onChange={event =>
            atualizar(event.target.value, event.target.selectionStart ?? 0)
          }
        />
      ) : (
        <textarea
          {...comuns}
          ref={campo as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          onChange={event =>
            atualizar(event.target.value, event.target.selectionStart ?? 0)
          }
        />
      )}

      {/* Só com o campo em foco: a dica fixa virava ruído em toda caixa de texto. */}
      {focado && !aberto ? (
        <span className="text-[10px] text-muted-foreground">
          {t('variaveis.dica')}
        </span>
      ) : null}

      {aberto && caixa
        ? createPortal(
            <ul
              style={{
                position: 'fixed',
                left: caixa.left,
                width: caixa.width,
                maxHeight: LISTA_ALTURA,
                ...(caixa.acima
                  ? { bottom: window.innerHeight - caixa.top + 4 }
                  : { top: caixa.top + 4 }),
              }}
              className="z-50 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
            >
              {filtradas.map((item, index) => (
                <li key={item.name}>
                  <button
                    type="button"
                    // `mouseDown`: o `blur` do `click` fecharia a lista sem inserir.
                    onMouseDown={event => {
                      event.preventDefault()
                      inserir(item.name)
                    }}
                    onMouseEnter={() => setAtivo(index)}
                    className={`flex w-full cursor-pointer items-center gap-2 px-2.5 py-1 text-left ${
                      index === ativo ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="shrink-0 font-mono text-[11px] text-foreground">
                      {item.name}
                    </span>
                    <span className="ml-auto truncate text-[10px] text-muted-foreground">
                      {item.hint
                        ? t('variaveis.capturadaEm', { bloco: item.hint })
                        : t(
                            item.origin === 'system'
                              ? `variaveis.sistema.${item.name}`
                              : 'variaveis.daConversa',
                          )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
