'use client'

import { useEffect, useReducer, useRef } from 'react'
import { ArrowLeft, ArrowRight, PartyPopper, RotateCcw } from 'lucide-react'
import { CtaButtons } from './cta-buttons'
import { WALKTHROUGH, WALKTHROUGH_DONE } from './content'
import type { ThinkzapCtas } from './resolve-ctas'
import {
  AppAside,
  BitrixMenu,
  SCREEN_FRAME,
  SCREENS,
  type ScreenFrame,
} from './walkthrough-screens'
import {
  INITIAL_WALKTHROUGH,
  walkthroughReducer,
  type WalkthroughAction,
  type WalkthroughState,
} from './walkthrough-state'

const TOTAL = WALKTHROUGH.length

const reducer = (state: WalkthroughState, action: WalkthroughAction) =>
  walkthroughReducer(TOTAL, state, action)

/**
 * Passo a passo simulado da instalação e configuração: uma janela do Bitrix24
 * desenhada em HTML onde o visitante clica no elemento destacado para avançar.
 *
 * O primeiro passo sai no HTML do servidor; o resto só existe com JS. Nada aqui
 * chama API — é tudo ilustração.
 */
export function InstallWalkthrough(ctas: ThinkzapCtas) {
  const [state, dispatch] = useReducer(reducer, INITIAL_WALKTHROUGH)
  const windowRef = useRef<HTMLDivElement>(null)
  const focusScreen = useRef(false)

  const current = WALKTHROUGH[state.step]
  const Screen = SCREENS[current.screen]

  // O botão clicado some com a tela; sem isto o foco cai no `body` e quem navega
  // por teclado perde o lugar. Só quando o clique veio da própria tela: nos
  // controles (Voltar, Próximo, bolinhas) o foco fica no botão apertado.
  useEffect(() => {
    if (!focusScreen.current) return
    focusScreen.current = false
    const target = windowRef.current?.querySelector<HTMLElement>(
      '[data-hotspot], [data-walkthrough-restart]',
    )
    target?.focus({ preventScroll: true })
  }, [state])

  const go = (action: WalkthroughAction, fromScreen = false) => {
    focusScreen.current = fromScreen
    dispatch(action)
  }

  // A conclusão fica dentro do app, na tela de conexões.
  const frame: ScreenFrame = state.done
    ? SCREEN_FRAME.lines
    : SCREEN_FRAME[current.screen]

  return (
    // Três blocos: texto, janela e controles. No celular empilham nessa ordem —
    // texto logo acima da janela, para o título novo ficar à vista quando o
    // visitante avança pela tela; no desktop texto e controles dividem a coluna
    // da esquerda.
    <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
      <div aria-live="polite" className="lg:min-h-[170px]">
        <p className="text-sm font-semibold text-primary">
          {state.done ? 'Concluído' : `Passo ${state.step + 1} de ${TOTAL}`}
        </p>
        <h3 className="mt-2 text-xl font-bold">
          {state.done ? WALKTHROUGH_DONE.title : current.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.done ? WALKTHROUGH_DONE.description : current.description}
        </p>
        {!state.done && (
          <p className="mt-3 text-xs text-muted-foreground">
            Clique no destaque laranja da tela:{' '}
            <strong className="text-foreground">{current.action}</strong>.
          </p>
        )}
      </div>

      <div
        ref={windowRef}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-2.5">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
            suaempresa.bitrix24.com.br/{frame.path}
          </span>
        </div>
        <div className="flex">
          {frame.kind === 'bitrix' && <BitrixMenu active={frame.menu} />}
          {frame.kind === 'app' && <AppAside active={frame.menu} />}
          <div
            key={state.done ? 'done' : current.screen}
            className="min-h-[480px] min-w-0 flex-1 bg-card motion-safe:animate-in motion-safe:fade-in"
          >
            {state.done ? (
              <DoneScreen
                ctas={ctas}
                onRestart={() => go({ type: 'restart' }, true)}
              />
            ) : (
              <Screen
                action={current.action}
                onAdvance={() => go({ type: 'next' }, true)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-start-1 lg:row-start-2">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{
              width: `${((state.done ? TOTAL : state.step + 1) / TOTAL) * 100}%`,
            }}
          />
        </div>

        <ol className="mt-4 flex flex-wrap gap-1.5">
          {WALKTHROUGH.map((step, index) => {
            const isCurrent = !state.done && index === state.step
            const isPast = state.done || index < state.step
            return (
              <li key={step.screen}>
                <button
                  type="button"
                  onClick={() => go({ type: 'goTo', step: index })}
                  aria-label={`Ir para o passo ${index + 1}: ${step.title}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:size-8 ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isPast
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {index + 1}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => go({ type: 'prev' })}
            disabled={!state.done && state.step === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Voltar
          </button>
          {!state.done && (
            <button
              type="button"
              onClick={() => go({ type: 'next' })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {state.step === TOTAL - 1 ? 'Concluir' : 'Próximo'}
              <ArrowRight aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DoneScreen({
  ctas,
  onRestart,
}: {
  ctas: ThinkzapCtas
  onRestart: () => void
}) {
  return (
    <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-5 p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <PartyPopper aria-hidden className="size-7" />
      </span>
      <div>
        <p className="text-lg font-bold">{WALKTHROUGH_DONE.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {WALKTHROUGH_DONE.description}
        </p>
      </div>
      <CtaButtons {...ctas} className="justify-center" />
      <button
        type="button"
        data-walkthrough-restart
        onClick={onRestart}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <RotateCcw aria-hidden className="size-4" />
        Ver de novo
      </button>
    </div>
  )
}
