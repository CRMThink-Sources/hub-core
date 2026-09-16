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
  HANDOFF_DISTRIBUTION_HINT,
  HANDOFF_DISTRIBUTION_LABEL,
  HANDOFF_DISTRIBUTIONS,
  type HandoffDistribution,
  type HandoffTarget,
  targetDistribution,
  targetUserIds,
  withDistribution,
} from '@/shared/thinkzap-bot-flow'

const field =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

const label = 'text-[10px] font-semibold uppercase text-muted-foreground'

/** Valor da opção "o mesmo canal da conversa" no seletor de canal (alvo `queue`). */
const MESMO_CANAL = ''

// O alvo é gravado como id, mas ninguém sabe o próprio id numérico — daí a busca por
// nome. O nome não é persistido: é do portal, e copiá-lo daria dois lugares para mudar.
export function HandoffTargetField({
  target,
  onChange,
  title = 'Distribuição',
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
  const distribuicao = target ? targetDistribution(target) : null
  const usuarios = target ? targetUserIds(target) : []

  return (
    <div
      className={`flex flex-col gap-1.5 ${bordered ? 'border-t border-border pt-2.5' : ''}`}
    >
      <span className={label}>{title}</span>
      <select
        value={distribuicao ?? ''}
        onChange={event =>
          onChange(
            event.target.value === ''
              ? null
              : withDistribution(
                  event.target.value as HandoffDistribution,
                  target,
                ),
          )
        }
        className={`${field} cursor-pointer`}
      >
        {noneLabel ? <option value="">{noneLabel}</option> : null}
        {HANDOFF_DISTRIBUTIONS.map(opcao => (
          <option key={opcao} value={opcao}>
            {HANDOFF_DISTRIBUTION_LABEL[opcao]}
          </option>
        ))}
      </select>

      {distribuicao ? (
        <p className="text-[10px] text-muted-foreground">
          {HANDOFF_DISTRIBUTION_HINT[distribuicao]}
        </p>
      ) : null}

      {distribuicao === 'channel' ? (
        <LinePicker
          lineId={target?.type === 'line' ? target.lineId : MESMO_CANAL}
          onPick={id =>
            onChange(
              id === MESMO_CANAL
                ? { type: 'queue' }
                : { type: 'line', lineId: id },
            )
          }
        />
      ) : null}

      {distribuicao === 'evenly' || distribuicao === 'all' ? (
        <UserPicker
          bitrixUserIds={usuarios}
          onChange={ids => onChange({ type: distribuicao, bitrixUserIds: ids })}
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

function UserPicker({
  bitrixUserIds,
  onChange,
}: {
  bitrixUserIds: string[]
  onChange: (bitrixUserIds: string[]) => void
}) {
  const [busca, setBusca] = useState('')
  const [hits, setHits] = useState<PortalUser[]>([])
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [nomes, setNomes] = useState<Record<string, PortalUser>>({})

  // Guarda os ids já procurados, achados ou não: id removido do portal buscaria sem fim.
  const procurados = useRef<Set<string>>(new Set())

  useEffect(() => {
    let ativo = true

    for (const id of bitrixUserIds) {
      if (!id || procurados.current.has(id)) continue
      procurados.current.add(id)

      getPortalUser(id)
        .then(user => {
          if (ativo && user) setNomes(atual => ({ ...atual, [id]: user }))
        })
        .catch(() => {})
    }

    return () => {
      ativo = false
    }
  }, [bitrixUserIds])

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

  function adicionar(user: PortalUser) {
    if (bitrixUserIds.includes(user.id)) return
    setNomes(atual => ({ ...atual, [user.id]: user }))
    onChange([...bitrixUserIds, user.id])
    setBusca('')
    setHits([])
  }

  return (
    <div className="flex flex-col gap-1.5">
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
          {hits.map(hit => {
            const jaEscolhido = bitrixUserIds.includes(hit.id)

            return (
              <li key={hit.id}>
                <button
                  type="button"
                  disabled={jaEscolhido}
                  onClick={() => adicionar(hit)}
                  className="flex w-full cursor-pointer flex-col items-start px-2 py-1 text-left hover:bg-muted disabled:cursor-default disabled:opacity-50"
                >
                  <span className="text-xs text-foreground">
                    {hit.name}
                    {jaEscolhido ? ' (já selecionado)' : ''}
                  </span>
                  {hit.position ? (
                    <span className="text-[10px] text-muted-foreground">
                      {hit.position}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : busca.trim().length >= 2 && !buscando ? (
        <p className="text-[10px] text-muted-foreground">
          Nenhum atendente com esse nome.
        </p>
      ) : bitrixUserIds.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Sem nenhum atendente selecionado, a publicação é recusada.
        </p>
      ) : null}

      {/* Abaixo da busca: quem já está escolhido é o resultado do campo de cima, e no
          topo empurrava a busca para fora da vista a cada atendente adicionado. */}
      {bitrixUserIds.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={label}>Usuários selecionados</span>
          <ul className="flex flex-col gap-1">
            {bitrixUserIds.map(id => {
              const escolhido = nomes[id]
              // Enquanto o nome não chega, o id sozinho não diz nada: mostra o esqueleto
              // no lugar de "Usuário #12", que parecia o valor final.
              const resolvendo = !escolhido && procurados.current.has(id)

              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5"
                >
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
                        {escolhido ? escolhido.name : `Usuário #${id}`}
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
                    aria-label="Remover atendente"
                    title="Remover atendente"
                    onClick={() =>
                      onChange(bitrixUserIds.filter(outro => outro !== id))
                    }
                    className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
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
    <select
      value={lineId}
      onChange={event => onPick(event.target.value)}
      className={`${field} cursor-pointer`}
    >
      {/* Sem escolha explícita a conversa fica na fila do canal em que já está, que é o
          caso comum — daí ser a primeira opção e não um estado pendente. */}
      <option value={MESMO_CANAL}>o mesmo canal da conversa</option>
      {linhas.map(linha => (
        <option key={String(linha.id)} value={String(linha.id)}>
          {linha.name?.trim() || `Canal #${linha.id}`}
        </option>
      ))}
    </select>
  )
}
