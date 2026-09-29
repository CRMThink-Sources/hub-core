'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, UserRound, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  getPortalUser,
  listOpenChannels,
  searchPortalUsers,
  type OpenChannel,
  type PortalUser,
} from '../../_lib/bot-flow-client'
import {
  HANDOFF_DISTRIBUTIONS,
  type HandoffDistribution,
  type HandoffTarget,
  targetDistribution,
  targetUserIds,
  withDistribution,
} from '@/shared/thinkzap-bot-flow'
import { FieldLabel, fieldLabel } from './field-label'

const field =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50'

/** Canal ainda não escolhido: o alvo fica `queue`, que a validação reprova. */
const SEM_CANAL = ''

// Busca por nome porque o alvo é id, e o nome não é persistido: é do portal.
export function HandoffTargetField({
  target,
  onChange,
  title,
  bordered = true,
  noneLabel,
}: {
  target: HandoffTarget | null
  onChange: (target: HandoffTarget | null) => void
  /** Ausente = "Distribuição", o rótulo padrão do campo. */
  title?: string
  /** A borda separa o campo do resto do painel de bloco; fora dele sobra risco solto. */
  bordered?: boolean
  /** Rótulo da opção "sem alvo". Ausente = escolha obrigatória, como no bloco. */
  noneLabel?: string
}) {
  const { t } = useTranslation('thinkzap/bots/bloco')
  const { t: tc } = useTranslation('thinkzap/bots/comum')
  const distribuicao = target ? targetDistribution(target) : null
  const usuarios = target ? targetUserIds(target) : []

  return (
    <div
      className={`flex flex-col gap-1.5 ${bordered ? 'border-t border-border pt-2.5' : ''}`}
    >
      <FieldLabel
        hint={distribuicao ? tc(`distribuicaoDica.${distribuicao}`) : undefined}
      >
        {title ?? t('handoff.distribuicao')}
      </FieldLabel>
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
            {tc(`distribuicao.${opcao}`)}
          </option>
        ))}
      </select>

      {distribuicao === 'channel' ? (
        <LinePicker
          lineId={target?.type === 'line' ? target.lineId : SEM_CANAL}
          onPick={id =>
            onChange(
              id === SEM_CANAL
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
  const { t } = useTranslation('thinkzap/bots/bloco')
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
          setErro(t('handoff.erroBuscar'))
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
          placeholder={t('handoff.buscarAtendente')}
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
                    {jaEscolhido ? t('handoff.jaSelecionado') : ''}
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
          {t('handoff.nenhumAtendente')}
        </p>
      ) : bitrixUserIds.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {t('handoff.semAtendente')}
        </p>
      ) : null}

      {/* Abaixo da busca: no topo, empurrava o campo para fora da vista. */}
      {bitrixUserIds.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className={fieldLabel}>
            {t('handoff.usuariosSelecionados')}
          </span>
          <ul className="flex flex-col gap-1">
            {bitrixUserIds.map(id => {
              const escolhido = nomes[id]
              // Esqueleto enquanto o nome não chega: "Usuário #12" parecia o valor final.
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
                        {escolhido
                          ? escolhido.name
                          : t('handoff.usuarioNumero', { id })}
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
                    aria-label={t('handoff.removerAtendente')}
                    title={t('handoff.removerAtendente')}
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
  const { t } = useTranslation('thinkzap/bots/bloco')
  const { t: tc } = useTranslation('thinkzap/bots/comum')
  const [linhas, setLinhas] = useState<OpenChannel[] | null>(null)
  const [erro, setErro] = useState(false)

  // Pela nossa API: o `BX24.callMethod` exigia o escopo `imopenlines` no app do cliente.
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
      <p className="text-[10px] text-destructive">{t('handoff.erroCanais')}</p>
    )
  }

  if (!linhas) {
    return (
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t('handoff.carregandoCanais')}
      </p>
    )
  }

  return (
    <select
      value={lineId}
      onChange={event => onPick(event.target.value)}
      className={`${field} cursor-pointer`}
    >
      {/* Placeholder, não destino: sem canal escolhido o bloco fica com problema. */}
      <option value={SEM_CANAL}>{t('handoff.selecioneCanal')}</option>
      {linhas.map(linha => (
        <option key={String(linha.id)} value={String(linha.id)}>
          {linha.name?.trim() || tc('canalNumero', { id: linha.id })}
        </option>
      ))}
    </select>
  )
}
