'use client'

import { useEffect, useReducer, useRef } from 'react'
import { ArrowLeft, ArrowRight, PartyPopper, RotateCcw } from 'lucide-react'
import { CtaButtons } from './cta-buttons'
import type { TutorialTrack } from './content'
import { BitrixMenu, type AppAsideComponent, type TutorialView } from './frame'
import { useLpBaseContent } from './lp-content-context'
import type { LpCtas } from './resolve-ctas'
import {
  INITIAL_WALKTHROUGH,
  walkthroughReducer,
  type WalkthroughAction,
  type WalkthroughState,
} from './walkthrough-state'

type NextTutorial = { label: string; onGo: () => void }

type Props<AppMenu extends string> = {
  track: TutorialTrack
  view: TutorialView<string, AppMenu>
  appAside: AppAsideComponent<AppMenu>
  ctas: LpCtas
  next?: NextTutorial
}

// Trocar de tutorial remonta o componente (`key` no pai), o que reinicia o passo.
export function TutorialPlayer<AppMenu extends string>({
  track,
  view,
  appAside: AppAside,
  ctas,
  next,
}: Props<AppMenu>) {
  const { player, frame: frameCopy } = useLpBaseContent()
  const total = track.steps.length
  const [state, dispatch] = useReducer(
    (current: WalkthroughState, action: WalkthroughAction) =>
      walkthroughReducer(total, current, action),
    INITIAL_WALKTHROUGH,
  )
  const windowRef = useRef<HTMLDivElement>(null)
  const focusScreen = useRef(false)

  const current = track.steps[state.step]
  const Screen = view.screens[current.screen]

  // Sem isto o foco cai no `body` quando o botão some; nos controles o foco fica no botão apertado.
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

  const frame =
    view.frames[(state.done ? track.steps[total - 1] : current).screen]

  return (
    // No celular o texto fica logo acima da janela para o título novo ficar à vista ao avançar.
    <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-10">
      <div aria-live="polite" className="lg:min-h-42.5">
        <p className="text-sm font-semibold text-primary">
          {state.done ? player.done : player.stepOf(state.step + 1, total)}
        </p>
        <h3 className="mt-2 text-xl font-bold">
          {state.done ? track.done.title : current.title}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {state.done ? track.done.description : current.description}
        </p>
        {!state.done && (
          <p className="mt-3 text-xs text-muted-foreground">
            {player.hint}{' '}
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
            {frameCopy.portalHost}/{frame.path}
          </span>
        </div>
        <div className="flex">
          {frame.kind === 'bitrix' && <BitrixMenu active={frame.menu} />}
          {frame.kind === 'app' && <AppAside active={frame.menu} />}
          <div
            key={state.done ? 'done' : current.screen}
            className="min-h-120 min-w-0 flex-1 bg-card motion-safe:animate-in motion-safe:fade-in"
          >
            {state.done ? (
              <DoneScreen
                done={track.done}
                ctas={ctas}
                next={next}
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
              width: `${((state.done ? total : state.step + 1) / total) * 100}%`,
            }}
          />
        </div>

        <ol className="mt-4 flex flex-wrap gap-1.5">
          {track.steps.map((step, index) => {
            const isCurrent = !state.done && index === state.step
            const isPast = state.done || index < state.step
            return (
              <li key={step.screen}>
                <button
                  type="button"
                  onClick={() => go({ type: 'goTo', step: index })}
                  aria-label={player.goToStep(index + 1, step.title)}
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
            {player.back}
          </button>
          {!state.done && (
            <button
              type="button"
              onClick={() => go({ type: 'next' })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {state.step === total - 1 ? player.finish : player.next}
              <ArrowRight aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DoneScreen({
  done,
  ctas,
  next,
  onRestart,
}: {
  done: TutorialTrack['done']
  ctas: LpCtas
  next?: NextTutorial
  onRestart: () => void
}) {
  const { player, ctaButtons } = useLpBaseContent()

  return (
    <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-5 p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <PartyPopper aria-hidden className="size-7" />
      </span>
      <div>
        <p className="text-lg font-bold">{done.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{done.description}</p>
      </div>
      <CtaButtons {...ctas} labels={ctaButtons} className="justify-center" />
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <button
          type="button"
          data-walkthrough-restart
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <RotateCcw aria-hidden className="size-4" />
          {player.restart}
        </button>
        {next && (
          <button
            type="button"
            onClick={next.onGo}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            {player.nextTutorial(next.label)}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
