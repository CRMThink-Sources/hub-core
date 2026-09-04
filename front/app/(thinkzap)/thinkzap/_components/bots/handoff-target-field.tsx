'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import {
  formatBitrixUserName,
  searchBitrixUsers,
  type BitrixUserSearchHit,
} from '@/bitrix'
import { listOpenChannels, type OpenChannel } from '../../_lib/bot-flow-client'
import {
  HANDOFF_TARGET_LABEL,
  HANDOFF_TARGET_TYPES,
  type HandoffTarget,
} from '@/shared/thinkzap-bot-flow'

const field =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

const label = 'text-[10px] font-semibold uppercase text-muted-foreground'

// O alvo é gravado como id, mas ninguém sabe o próprio id numérico — daí a busca por
// nome. O nome não é persistido: é do portal, e copiá-lo daria dois lugares para mudar.
export function HandoffTargetField({
  target,
  onChange,
}: {
  target: HandoffTarget
  onChange: (target: HandoffTarget) => void
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
      <span className={label}>Entregar para</span>
      <select
        value={target.type}
        onChange={event => onChange(alvoVazio(event.target.value))}
        className={`${field} cursor-pointer`}
      >
        {HANDOFF_TARGET_TYPES.map(tipo => (
          <option key={tipo} value={tipo}>
            {HANDOFF_TARGET_LABEL[tipo]}
          </option>
        ))}
      </select>

      {target.type === 'user' ? (
        <UserPicker
          bitrixUserId={target.bitrixUserId}
          onPick={id => onChange({ type: 'user', bitrixUserId: id })}
        />
      ) : null}

      {target.type === 'line' ? (
        <LinePicker
          lineId={target.lineId}
          onPick={id => onChange({ type: 'line', lineId: id })}
        />
      ) : null}
    </div>
  )
}

// Zera o id: manter o anterior gravaria `bitrixUserId` num alvo `line`, que o zod do
// servidor recusa no `PATCH`.
function alvoVazio(tipo: string): HandoffTarget {
  if (tipo === 'user') return { type: 'user', bitrixUserId: '' }
  if (tipo === 'line') return { type: 'line', lineId: '' }
  return { type: 'queue' }
}

function UserPicker({
  bitrixUserId,
  onPick,
}: {
  bitrixUserId: string
  onPick: (bitrixUserId: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [hits, setHits] = useState<BitrixUserSearchHit[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<BitrixUserSearchHit | null>(null)

  // `String(ID)` na comparação: `user.get` devolve o id como número em algumas versões
  // do portal. Guarda o id já procurado, achado ou não — id removido do portal buscaria
  // sem fim.
  const procurado = useRef<string | null>(null)

  useEffect(() => {
    if (!bitrixUserId || procurado.current === bitrixUserId) return
    procurado.current = bitrixUserId

    let ativo = true
    searchBitrixUsers('')
      .then(todos => {
        if (!ativo) return
        setEscolhido(todos.find(hit => String(hit.ID) === bitrixUserId) ?? null)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [bitrixUserId])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function buscar(termo: string) {
    setBusca(termo)
    if (timer.current) clearTimeout(timer.current)
    if (termo.trim().length < 2) {
      setHits([])
      return
    }
    // Debounce: `user.get` consome o orçamento de request do portal por tecla digitada.
    timer.current = setTimeout(() => {
      setBuscando(true)
      setErro(null)
      searchBitrixUsers(termo.trim())
        .then(setHits)
        .catch(() => {
          setErro('Não foi possível buscar usuários do portal.')
          setHits([])
        })
        .finally(() => setBuscando(false))
    }, 350)
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  if (bitrixUserId) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          {escolhido
            ? formatBitrixUserName(escolhido)
            : `Usuário #${bitrixUserId}`}
        </span>
        <button
          type="button"
          aria-label="Trocar atendente"
          onClick={() => {
            setEscolhido(null)
            onPick('')
          }}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          placeholder="buscar atendente pelo nome"
          onChange={event => buscar(event.target.value)}
          className={`${field} pl-6`}
        />
        {buscando ? (
          <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {erro ? (
        <p className="text-[10px] text-destructive">{erro}</p>
      ) : hits.length > 0 ? (
        <ul className="max-h-36 overflow-y-auto rounded-md border border-border">
          {hits.map(hit => (
            <li key={hit.ID}>
              <button
                type="button"
                onClick={() => {
                  setEscolhido(hit)
                  onPick(String(hit.ID))
                }}
                className="flex w-full cursor-pointer flex-col items-start px-2 py-1 text-left hover:bg-muted"
              >
                <span className="text-xs text-foreground">
                  {formatBitrixUserName(hit)}
                </span>
                {hit.WORK_POSITION ? (
                  <span className="text-[10px] text-muted-foreground">
                    {hit.WORK_POSITION}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : busca.trim().length >= 2 && !buscando ? (
        <p className="text-[10px] text-muted-foreground">
          Nenhum atendente com esse nome.
        </p>
      ) : (
        <p className="text-[10px] text-muted-foreground">
          Sem atendente escolhido, a publicação é recusada.
        </p>
      )}
    </div>
  )
}

function LinePicker({
  lineId,
  onPick,
}: {
  lineId: string
  onPick: (lineId: string) => void
}) {
  const [linhas, setLinhas] = useState<OpenChannel[] | null>(null)
  const [erro, setErro] = useState(false)

  // Pela nossa API, não por `BX24.callMethod`: o caminho do browser exigia o script do
  // portal carregado e o escopo `imopenlines` no app do cliente.
  useEffect(() => {
    let ativo = true
    listOpenChannels()
      .then(todas => {
        if (ativo) setLinhas(todas.filter(canal => canal.active))
      })
      .catch(() => {
        if (ativo) setErro(true)
      })
    return () => {
      ativo = false
    }
  }, [])

  if (erro) {
    return (
      <p className="text-[10px] text-destructive">
        Não foi possível listar os canais abertos.
      </p>
    )
  }

  if (!linhas) {
    return (
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        carregando canais
      </p>
    )
  }

  return (
    <>
      <select
        value={lineId}
        onChange={event => onPick(event.target.value)}
        className={`${field} cursor-pointer ${lineId ? '' : 'border-amber-500 text-amber-700'}`}
      >
        <option value="">escolher canal…</option>
        {linhas.map(linha => (
          <option key={String(linha.id)} value={String(linha.id)}>
            {linha.name?.trim() || `Canal #${linha.id}`}
          </option>
        ))}
      </select>
      {linhas.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Nenhum canal aberto ativo no portal.
        </p>
      ) : null}
    </>
  )
}
