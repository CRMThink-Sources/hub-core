'use client'

import { useEffect, useRef, useState } from 'react'
import { EyeOff, Headset, RotateCcw, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { simulateBotFlow } from '../../_lib/bot-flow-client'
import type {
  BotEffect,
  BotFlowGraph,
  SimulationState,
} from '@/shared/thinkzap-bot-flow'

type Bubble =
  | { from: 'bot'; text: string }
  | { from: 'cliente'; text: string }
  | { from: 'sistema'; text: string }
  /** Só o atendente lê no Bitrix; aqui aparece para o autor conferir o resumo. */
  | { from: 'sussurro'; text: string }

// Manda o `graph` da tela, não o `flowId`: o valor está em testar o que ainda não foi
// publicado, com o motor do servidor.
export function BotFlowSimulator({
  graph,
  onClose,
}: {
  graph: BotFlowGraph
  /** O botão da barra também fecha, mas ninguém lê um botão aceso como "fechar". */
  onClose?: () => void
}) {
  const { t } = useTranslation('thinkzap/bots/simulador')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [state, setState] = useState<SimulationState | null>(null)
  const [encerrada, setEncerrada] = useState(false)
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const fim = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'nearest' })
  }, [bubbles])

  // Fluxo editado invalida a conversa: o estado aponta para nó do grafo anterior.
  useEffect(() => {
    setBubbles(current =>
      current.length === 0
        ? current
        : [{ from: 'sistema', text: t('sistema.fluxoMudou') }],
    )
    setState(null)
    setEncerrada(false)
  }, [graph, t])

  function aplicar(effects: BotEffect[]): Bubble[] {
    return effects.map((effect): Bubble => {
      if (effect.kind === 'say') return { from: 'bot', text: effect.text }
      // O cliente não vê: aqui vale mostrar para o autor conferir o que o atendente recebe.
      if (effect.kind === 'whisper') {
        return { from: 'sussurro', text: effect.text }
      }
      if (effect.kind === 'handoff') {
        return { from: 'sistema', text: t('sistema.handoff') }
      }
      if (effect.kind === 'finish') {
        return { from: 'sistema', text: t('sistema.finish') }
      }
      return {
        from: 'sistema',
        text:
          effect.reason === 'loop'
            ? t('sistema.loop')
            : t('sistema.noInexistente'),
      }
    })
  }

  async function turno(
    input: { kind: 'start' } | { kind: 'text'; text: string },
    proximas: Bubble[],
  ) {
    setOcupado(true)
    try {
      const result = await simulateBotFlow({ graph, state, input })
      setBubbles([...proximas, ...aplicar(result.effects)])
      setState(result.state)
      setEncerrada(result.state === null)
    } catch (error) {
      setBubbles([
        ...proximas,
        {
          from: 'sistema',
          text: error instanceof Error ? error.message : t('sistema.erro'),
        },
      ])
    } finally {
      setOcupado(false)
    }
  }

  async function reiniciar() {
    setState(null)
    setEncerrada(false)
    setTexto('')
    await turno({ kind: 'start' }, [])
  }

  async function enviar(event: React.FormEvent) {
    event.preventDefault()
    const valor = texto.trim()
    if (valor.length === 0 || ocupado) return

    setTexto('')
    await turno({ kind: 'text', text: valor }, [
      ...bubbles,
      { from: 'cliente', text: valor },
    ])
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2 border-b border-border pb-2">
        <h2 className="text-sm font-semibold text-foreground">{t('titulo')}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {t('aviso')}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label={t('reiniciar')}
          title={t('reiniciar')}
          disabled={ocupado}
          onClick={() => void reiniciar()}
        >
          <RotateCcw />
        </Button>

        {onClose ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('fechar')}
            title={t('fechar')}
            onClick={onClose}
          >
            <X />
          </Button>
        ) : null}
      </header>

      <div className="flex min-h-70 flex-1 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/40 p-3">
        {bubbles.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="max-w-55 text-xs text-muted-foreground">
              {t('vazio')}
            </p>
            <Button
              size="sm"
              disabled={ocupado}
              onClick={() => void reiniciar()}
            >
              {t('iniciar')}
            </Button>
          </div>
        ) : (
          bubbles.map((bubble, index) => (
            <div
              key={index}
              className={
                bubble.from === 'cliente'
                  ? 'self-end rounded-lg rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground whitespace-pre-wrap max-w-[85%]'
                  : bubble.from === 'bot'
                    ? 'self-start rounded-lg rounded-bl-sm bg-background px-3 py-2 text-xs text-foreground shadow-xs whitespace-pre-wrap max-w-[85%]'
                    : bubble.from === 'sussurro'
                      ? 'self-start rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-w-[85%]'
                      : 'self-center rounded-full bg-foreground/5 px-3 py-1 text-[11px] text-muted-foreground'
              }
            >
              {bubble.from === 'sistema' ? (
                <span className="inline-flex items-center gap-1">
                  <Headset className="h-3 w-3" />
                  {bubble.text}
                </span>
              ) : bubble.from === 'sussurro' ? (
                <>
                  {/* Tracejado e rótulo: sem eles o resumo parece fala que o cliente leu. */}
                  <span className="mb-1 flex items-center gap-1 font-semibold uppercase">
                    <EyeOff className="h-3 w-3" />
                    {t('sussurro')}
                  </span>
                  {bubble.text}
                </>
              ) : (
                bubble.text
              )}
            </div>
          ))
        )}
        <div ref={fim} />
      </div>

      <form
        onSubmit={event => void enviar(event)}
        className="flex items-center gap-2"
      >
        <Input
          value={texto}
          disabled={ocupado || encerrada || bubbles.length === 0}
          placeholder={
            encerrada ? t('encerradaPlaceholder') : t('respostaPlaceholder')
          }
          className="h-9 text-xs"
          onChange={event => setTexto(event.target.value)}
        />
        <Button
          type="submit"
          size="icon-sm"
          aria-label={t('enviar')}
          disabled={ocupado || encerrada || texto.trim().length === 0}
        >
          <Send />
        </Button>
      </form>
    </div>
  )
}
