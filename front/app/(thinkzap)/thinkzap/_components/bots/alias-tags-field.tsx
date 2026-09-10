'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

/**
 * Os sinônimos da opção como etiquetas, e não como uma linha de texto separada por vírgula.
 *
 * Com o campo de texto, remover o item do meio de `boleto, dinheiro, pix` era editar a
 * string e acertar as vírgulas; e a lista longa rolava dentro do input, escondendo o que já
 * estava cadastrado. Como etiqueta, cada sinônimo tem o próprio botão de remover e todos
 * ficam visíveis de uma vez.
 *
 * Vírgula e Enter fecham a etiqueta — os dois porque o operador que vem do campo antigo
 * digita vírgula por hábito. Backspace com o campo vazio apaga a última, que é o gesto
 * esperado de quem acabou de digitar errado.
 */
export function AliasTagsField({
  aliases,
  onChange,
}: {
  aliases: string[]
  /** Lista completa depois da edição. Quem chama decide o que fazer com a lista vazia. */
  onChange: (proximos: string[]) => void
}) {
  const [rascunho, setRascunho] = useState('')

  // Duplicata não é erro de digitação a corrigir: o operador colou de novo, e o motor
  // pararia na primeira ocorrência de qualquer forma.
  function adicionar(texto: string) {
    const limpo = texto.trim()
    if (!limpo) return

    const existe = aliases.some(
      alias => alias.toLowerCase() === limpo.toLowerCase(),
    )
    if (!existe) onChange([...aliases, limpo])

    setRascunho('')
  }

  return (
    <div
      className={`flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-1.5 py-1 focus-within:border-ring`}
    >
      {aliases.map((alias, index) => (
        <span
          key={`${alias}-${index}`}
          className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
        >
          {alias}
          <button
            type="button"
            aria-label={`Remover ${alias}`}
            onClick={() => onChange(aliases.filter((_, i) => i !== index))}
            className="cursor-pointer text-primary/60 hover:text-destructive"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <input
        value={rascunho}
        placeholder={aliases.length ? '' : 'ajuda, problema, técnico'}
        onChange={event => {
          const valor = event.target.value
          // Vírgula fecha a etiqueta em vez de entrar no texto: colar
          // `boleto, dinheiro` vira duas etiquetas, não uma.
          if (valor.includes(',')) {
            const partes = valor.split(',')
            const ultima = partes.pop() ?? ''
            partes.forEach(adicionar)
            setRascunho(ultima.trim())
            return
          }
          setRascunho(valor)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            // A tecla fecha a etiqueta; sem isto o formulário do painel submeteria.
            event.preventDefault()
            adicionar(rascunho)
            return
          }
          if (event.key === 'Backspace' && !rascunho && aliases.length) {
            onChange(aliases.slice(0, -1))
          }
        }}
        // O rascunho pendente não pode sumir na saída do campo: quem digita e clica
        // fora do painel esperaria a etiqueta gravada.
        onBlur={() => adicionar(rascunho)}
        className="min-w-16 flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
