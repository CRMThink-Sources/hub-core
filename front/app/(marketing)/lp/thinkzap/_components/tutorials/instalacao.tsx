import Image from 'next/image'
import { Check, Search } from 'lucide-react'
import type { InstalacaoScreen } from '../content'
import { useTutorialScreens } from '../content/locale-context'
import {
  APP_PATH,
  HotspotButton,
  Hotspot,
  SkeletonCard,
  type ScreenProps,
  type TutorialView,
} from './shared/frame'

/**
 * Tutorial "Instalação". Espelha:
 * - Market do Bitrix24 (busca e card do app)
 * - instalação: `components/bitrix/install/install-form.tsx` + `terms-agreement.tsx`
 *
 * Mudou uma dessas telas, mude aqui também.
 */
export const INSTALACAO_VIEW: TutorialView<InstalacaoScreen> = {
  frames: {
    market: { kind: 'bitrix', path: 'market/', menu: 'market' },
    install: { kind: 'bare', path: APP_PATH },
  },
  screens: {
    market: MarketScreen,
    install: InstallScreen,
  },
}

function MarketScreen({ action, onAdvance }: ScreenProps) {
  const { market } = useTutorialScreens('instalacao')

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <p className="text-base font-semibold">{market.title}</p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
        <Search aria-hidden className="size-4 text-muted-foreground" />
        <span>ThinkZap</span>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-background p-4 sm:flex-row sm:items-center">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1.5">
          <Image
            src="/images/thinkzap/logo.png"
            alt=""
            width={90}
            height={42}
            className="h-auto w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">ThinkZap</p>
          <p className="text-sm text-muted-foreground">{market.appTagline}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {market.category}
          </p>
        </div>
        <HotspotButton action={action} onAdvance={onAdvance} />
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

function InstallScreen({ action, onAdvance }: ScreenProps) {
  const { install } = useTutorialScreens('instalacao')

  return (
    <div className="flex h-full min-h-[inherit] items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/50">
        <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-5 text-center text-white">
          <p className="text-lg font-bold tracking-tight">{install.title}</p>
          <p className="mt-1 text-xs text-indigo-100">{install.subtitle}</p>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold text-slate-700">
              {install.emailLabel}
            </p>
            <p className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-400">
              {install.emailPlaceholder}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              {install.termsTitle}
            </p>
            <div className="space-y-1 rounded-xl bg-slate-50/80 p-2">
              {install.terms.map(term => (
                <p
                  key={term}
                  className="flex gap-2 p-1.5 text-xs text-slate-600"
                >
                  <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded bg-indigo-600 text-white">
                    <Check aria-hidden className="size-3" />
                  </span>
                  <span>
                    {install.accept}{' '}
                    <span className="font-medium text-indigo-600 underline">
                      {term}
                    </span>
                    .
                  </span>
                </p>
              ))}
            </div>
          </div>
          <Hotspot
            action={action}
            onAdvance={onAdvance}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700"
          >
            {install.submit}
          </Hotspot>
        </div>
      </div>
    </div>
  )
}
