'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, UserRound, X } from 'lucide-react'
import {
  getPortalUser,
  listOpenChannels,
  searchPortalUsers,
  type OpenChannel,
  type PortalUser,
} from '../../_lib/bot-flow-client'
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
  title = 'Entregar para',
  bordered = true,
  noneLabel,
}: {
  target: HandoffTarget | null
  onChange: (target: HandoffTarget | null) => void
  title?: string
  /** A borda separa o campo do resto do painel de bloco; fora dele sobra risco solto. */
  bordered?: boolean
  /** Rótulo da opção "sem alvo". Ausente = escolha obrigatória, como no bloco. */
  noneLabel?: string
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 ${bordered ? 'border-t border-border pt-2.5' : ''}`}
    >
      <span className={label}>{title}</span>
      <select
        value={target?.type ?? ''}
        onChange={event =>
          onChange(
            event.target.value === '' ? null : alvoVazio(event.target.value),
          )
        }
        className={`${field} cursor-pointer`}
      >
        {noneLabel ? <option value="">{noneLabel}</option> : null}
        {HANDOFF_TARGET_TYPES.map(tipo => (
          <option key={tipo} value={tipo}>
            {HANDOFF_TARGET_LABEL[tipo]}
          </option>
        ))}
      </select>

      {target?.type === 'user' ? (
        <UserPicker
          bitrixUserId={target.bitrixUserId}
          onPick={id => onChange({ type: 'user', bitrixUserId: id })}
        />
      ) : null}

      {target?.type === 'line' ? (
        <LinePicker
          lineId={target.lineId}
          onPick={id => onChange({ type: 'line', lineId: id })}
        />
      ) : null}
    </div>
  )
}

/** Primeira e última inicial: "Gustavo Henrique Silvano" → "GS". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? '?'
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] : ''
  return `${primeira}${ultima ?? ''}`
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
  const [hits, setHits] = useState<PortalUser[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<PortalUser | null>(null)

  // Guarda o id já procurado, achado ou não: id removido do portal buscaria sem fim.
  const procurado = useRef<string | null>(null)

  useEffect(() => {
    if (!bitrixUserId || procurado.current === bitrixUserId) return
    procurado.current = bitrixUserId

    let ativo = true
    getPortalUser(bitrixUserId)
      .then(user => {
        if (ativo) setEscolhido(user)
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
      searchPortalUsers(termo.trim())
        .then(setHits)
        .catch(() => {
          setErro('Não foi possível buscar os atendentes do portal.')
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
    // Enquanto o nome não chega, o id sozinho não diz nada: mostra o esqueleto no lugar
    // de "Usuário #12", que parecia o valor final.
    const resolvendo = escolhido === null && procurado.current === bitrixUserId

    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold uppercase text-primary">
          {escolhido ? (
            iniciais(escolhido.name)
          ) : (
            <UserRound className="h-3 w-3" />
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          {resolvendo ? (
            <span className="h-3 w-28 animate-pulse rounded bg-muted-foreground/20" />
          ) : (
            <span className="truncate text-xs font-medium text-foreground">
              {escolhido ? escolhido.name : `Usuário #${bitrixUserId}`}
            </span>
          )}
          {escolhido?.position ? (
            <span className="truncate text-[10px] text-muted-foreground">
              {escolhido.position}
            </span>
          ) : null}
        </span>

        <button
          type="button"
          aria-label="Trocar atendente"
          title="Trocar atendente"
          onClick={() => {
            setEscolhido(null)
            onPick('')
          }}
          className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
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
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => {
                  setEscolhido(hit)
                  onPick(hit.id)
                }}
                className="flex w-full cursor-pointer flex-col items-start px-2 py-1 text-left hover:bg-muted"
              >
                <span className="text-xs text-foreground">{hit.name}</span>
                {hit.position ? (
                  <span className="text-[10px] text-muted-foreground">
                    {hit.position}
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
