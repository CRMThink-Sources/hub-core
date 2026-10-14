import Image from 'next/image'
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  ExternalLink,
  Heart,
  Link2,
  Search,
  Star,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Hotspot, type ScreenProps } from './frame'

// Layout por `@container`: a janela do tutorial muda de largura sem a página mudar.

export type MarketCopy = {
  appsCount: string
  catalog: string
  scope: string
  favorites: string
  more: string
  searchResults: string
  seeAll: string
  install: string
  rating: string
  installs: string
  developer: string
  category: string
  description: string
  /** Só para app com preço público. */
  priceTag?: string
  /** Só para app com planos pagos dentro dele. */
  inAppPurchases?: string
}

export type MarketApp = {
  name: string
  tagline: string
  category: string
  developer: string
  logo: { src: string; width: number; height: number }
}

type MarketProps = { copy: MarketCopy; app: MarketApp }

const RESULT_COUNT = 4

export function MarketCatalog({
  action,
  onAdvance,
  ...props
}: MarketProps & ScreenProps) {
  return <Catalog {...props} hotspot={{ action, onAdvance }} />
}

export function MarketAppDetail({
  copy,
  app,
  action,
  onAdvance,
}: MarketProps & ScreenProps) {
  return (
    <div className="@container relative overflow-hidden">
      <div aria-hidden className="pointer-events-none">
        <Catalog copy={copy} app={app} />
      </div>
      <div aria-hidden className="absolute inset-0 bg-[#123e72]/65" />

      <div className="absolute inset-y-0 right-0 w-full @lg:w-[86%] @2xl:w-[72%]">
        <div
          aria-hidden
          className="absolute right-full top-3 mr-2 hidden flex-col gap-2 @lg:flex"
        >
          {[X, Link2, ExternalLink].map((Icon, index) => (
            <span
              key={index}
              className="flex size-8 items-center justify-center rounded-full bg-[#2fc6f6] text-white shadow-md"
            >
              <Icon className="size-4" />
            </span>
          ))}
        </div>

        <div className="@container h-full overflow-hidden bg-white text-[#333]">
          <div className="relative flex gap-4 border-b border-[#eef0f2] p-4 @md:gap-6 @md:p-6">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-[22px] border border-[#e3e7eb] bg-linear-to-br from-[#eef6fc] to-white p-2.5 @md:size-24 @md:p-3">
              <AppLogo app={app} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="truncate pr-10 text-xl font-medium leading-tight @md:mt-1 @md:text-2xl">
                {app.name}
              </p>
              <p className="mt-1 line-clamp-2 pr-10 text-xs text-[#828b95]">
                {app.tagline}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-2 pt-3 text-xs text-[#525c69]">
                <Hotspot
                  action={action}
                  onAdvance={onAdvance}
                  className="inline-flex h-9 items-center rounded bg-[#bbed21] px-4 text-xs font-medium uppercase text-[#333] transition hover:bg-[#d2f95f]"
                >
                  {copy.install}
                </Hotspot>
                {copy.priceTag && (
                  <>
                    <Divider />
                    <span className="rounded-full bg-[#eef2f4] px-2.5 py-1 text-[10px] uppercase leading-none text-[#a8adb4]">
                      {copy.priceTag}
                    </span>
                  </>
                )}
                {copy.inAppPurchases && (
                  <>
                    <Divider />
                    <span>{copy.inAppPurchases}</span>
                  </>
                )}
              </div>
            </div>
            <span
              aria-hidden
              className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-[#f1f4f6] text-[#c3c8cd] @md:right-5 @md:top-5"
            >
              <Heart className="size-4" />
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-y-3 py-4 text-center @md:grid-cols-4">
            <Stat label={copy.rating}>
              <span className="mx-auto block h-6 w-12 rounded-md bg-[#eef1f3]" />
            </Stat>
            <Stat label={copy.installs} className="border-l">
              <span className="mx-auto mt-1.5 block h-3 w-10 rounded bg-[#eef1f3]" />
            </Stat>
            <Stat label={copy.developer} className="@md:border-l">
              {app.developer}
            </Stat>
            <Stat label={copy.category} className="border-l">
              {app.category}
            </Stat>
          </dl>

          <div aria-hidden className="relative bg-[#f5f7f8] px-4 py-4 @md:px-6">
            <span className="grid grid-cols-1 gap-4 @md:grid-cols-2">
              <ScreenshotPlaceholder />
              <span className="hidden @md:block">
                <ScreenshotPlaceholder />
              </span>
            </span>
            <span className="absolute left-2 top-[42%] flex size-8 items-center justify-center rounded-full bg-[#dfe3e8]/80 text-[#828b95]">
              <ChevronLeft className="size-4" />
            </span>
            <span className="absolute right-2 top-[42%] flex size-8 items-center justify-center rounded-full bg-[#dfe3e8]/80 text-[#828b95]">
              <ChevronRight className="size-4" />
            </span>
            <span className="mt-3 flex justify-center gap-1.5">
              {[0, 1, 2, 3, 4].map(dot => (
                <span
                  key={dot}
                  className={cn(
                    'size-1.5 rounded-full border border-[#828b95]',
                    dot === 0 && 'bg-[#525c69]',
                  )}
                />
              ))}
            </span>
          </div>

          <div className="px-4 py-5 @md:px-6">
            <p className="text-lg font-medium">{copy.description}</p>
            <span aria-hidden className="mt-3 block space-y-2">
              <span className="block h-2.5 w-11/12 rounded bg-[#eef0f2]" />
              <span className="block h-2.5 w-3/4 rounded bg-[#eef0f2]" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Catalog({
  copy,
  app,
  hotspot,
}: MarketProps & { hotspot?: ScreenProps }) {
  const card = <AppCard copy={copy} app={app} />

  return (
    <div className="@container h-120 overflow-hidden bg-[#f2f4f6] text-[#333]">
      <TopBar copy={copy} query={app.name} />
      <div className="space-y-4 p-3 @xl:space-y-5 @xl:p-5">
        <section className="relative rounded-3xl bg-white px-4 pb-5 pt-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] @xl:px-6 @xl:pt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm text-[#1f2328] @md:text-base @xl:text-xl">
              {copy.searchResults}
              <span className="ml-2 text-[#a8adb4]">{RESULT_COUNT}</span>
            </p>
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-3.5 py-1.5 text-sm text-[#0b66c3] shadow-[0_1px_6px_rgba(0,0,0,0.1)]">
              {copy.seeAll}
              <ChevronRight aria-hidden className="size-3.5 text-[#a8adb4]" />
            </span>
          </div>
          <div className="-mx-2 mt-2 grid auto-cols-[46%] grid-flow-col gap-4 overflow-hidden p-2 @xl:auto-cols-[31%] @xl:gap-5">
            {hotspot ? (
              <Hotspot
                {...hotspot}
                className="block w-full rounded-xl text-left text-[#333] ring-offset-4 ring-offset-white"
                dotClassName="-right-1.5 -top-1.5"
              >
                {card}
              </Hotspot>
            ) : (
              card
            )}
            {Array.from({ length: RESULT_COUNT - 1 }, (_, index) => (
              <SkeletonAppCard key={index} />
            ))}
          </div>
          <span
            aria-hidden
            className="absolute right-0 top-[38%] flex h-12 w-7 items-center justify-center rounded-l-full bg-[#e9edf0]/90 text-white"
          >
            <ChevronRight className="size-4" />
          </span>
        </section>

        <div aria-hidden className="grid grid-cols-5 gap-4 @xl:gap-5">
          <FeaturedTile />
          <section className="col-span-3 rounded-3xl bg-white p-4 @xl:p-6">
            <span className="flex items-center justify-between">
              <span className="block h-4 w-2/5 rounded bg-[#e9edf0]" />
              <span className="block h-7 w-16 rounded-full bg-white shadow-[0_1px_6px_rgba(0,0,0,0.1)]" />
            </span>
            <span className="mt-5 grid grid-cols-2 gap-4">
              <SkeletonAppCard />
              <SkeletonAppCard />
            </span>
          </section>
        </div>
      </div>
    </div>
  )
}

function TopBar({ copy, query }: { copy: MarketCopy; query: string }) {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-[#e9edf0] bg-white px-3 @xl:gap-4 @xl:px-5">
      <span className="flex shrink-0 items-center gap-2">
        <MarketMark />
        <span className="hidden leading-tight @2xl:block">
          <span className="block text-[15px] font-medium text-[#1f2328]">
            Bitrix24 Market
          </span>
          <span className="block text-[10px] text-[#828b95]">
            {copy.appsCount}
          </span>
        </span>
      </span>
      <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-[#2fc6f6] px-2.5 text-sm text-white @xl:px-4">
        <BookOpen aria-hidden className="size-4" />
        <span className="hidden @xl:inline">{copy.catalog}</span>
      </span>
      <span className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#7fd6f7] p-0.75 pr-3 text-xs">
        <span className="hidden h-full shrink-0 items-center gap-1.5 rounded-l-full rounded-r-md bg-[#2fc6f6] pl-3 pr-2 text-white @lg:inline-flex">
          {copy.scope}
          <ChevronDown aria-hidden className="size-3" />
        </span>
        <span className="min-w-0 flex-1 truncate pl-2 text-[#333]">
          {query}
        </span>
        <Search aria-hidden className="size-4 shrink-0 text-[#a8adb4]" />
      </span>
      <span className="flex shrink-0 items-center gap-4 text-[11px] text-[#a8adb4]">
        <span className="hidden flex-col items-center gap-0.5 @2xl:flex">
          <Heart aria-hidden className="size-4" />
          {copy.favorites}
        </span>
        <span className="relative flex flex-col items-center gap-0.5">
          <Ellipsis aria-hidden className="size-4" />
          <span className="hidden @2xl:block">{copy.more}</span>
          <span
            aria-hidden
            className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-[#ff5752] text-[9px] font-semibold text-white"
          >
            3
          </span>
        </span>
      </span>
    </div>
  )
}

function MarketMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-7">
      <path
        d="M5 19 12 5"
        stroke="#bbed21"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M12 19 19 5"
        stroke="#2fc6f6"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function Divider() {
  return <span aria-hidden className="hidden h-5 w-px bg-[#dfe3e8] @lg:block" />
}

function AppLogo({ app }: { app: MarketApp }) {
  return (
    <Image
      src={app.logo.src}
      alt=""
      width={app.logo.width}
      height={app.logo.height}
      className="h-auto w-full object-contain"
    />
  )
}

function AppCard({ copy, app }: MarketProps) {
  return (
    <span className="block">
      <span className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-[#e9f5fd] via-[#f7fbfe] to-[#eef3f7] shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
        <span
          aria-hidden
          className="absolute -right-6 -top-10 size-32 rounded-full bg-white/70"
        />
        <span className="relative flex w-[46%] items-center justify-center rounded-2xl bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <AppLogo app={app} />
        </span>
        {copy.priceTag && (
          <span className="absolute bottom-2 left-2 rounded-sm bg-[#8fc31f] px-1.5 py-0.5 text-[10px] text-white">
            {copy.priceTag}
          </span>
        )}
      </span>
      <span className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-[#1f2328]">
          {app.name}
        </span>
        <Heart aria-hidden className="size-4 shrink-0 text-[#c3c8cd]" />
      </span>
      <span className="mt-2 line-clamp-2 min-h-[2lh] text-[11px] leading-snug text-[#828b95]">
        {app.tagline}
      </span>
      <StarsRow />
    </span>
  )
}

// Sem números: a avaliação real não é nossa.
function StarsRow({ faded = false }: { faded?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-2.5 flex items-center gap-0.5 text-[#c8cdd2]',
        faded && 'opacity-60',
      )}
    >
      {[0, 1, 2, 3, 4].map(star => (
        <Star key={star} className="size-3" />
      ))}
      <Download className="ml-2.5 size-3" />
      <span className="ml-1 block h-2 w-7 rounded bg-[#eef0f2]" />
    </span>
  )
}

function SkeletonAppCard() {
  return (
    <span aria-hidden className="block">
      <span className="flex aspect-video items-center justify-center rounded-xl bg-linear-to-br from-[#f1f4f6] to-[#f8f9fa] shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <span className="h-1/2 w-[38%] rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]" />
      </span>
      <span className="mt-3 flex items-center justify-between gap-2">
        <span className="block h-2.5 w-3/5 rounded bg-[#e9edf0]" />
        <Heart className="size-4 shrink-0 text-[#e3e7eb]" />
      </span>
      <span className="mt-2.5 block h-2 w-11/12 rounded bg-[#f1f3f5]" />
      <span className="mt-1.5 block h-2 w-3/4 rounded bg-[#f1f3f5]" />
      <StarsRow faded />
    </span>
  )
}

function FeaturedTile() {
  return (
    <span className="relative col-span-2 block h-56 overflow-hidden rounded-3xl bg-linear-to-br from-[#2b3440] via-[#151b23] to-[#0b0f14]">
      <span className="absolute inset-x-5 top-5 flex h-24 items-end gap-1.5 rounded-lg bg-[#1d2530] p-3">
        {[35, 70, 50, 90, 60, 40, 75, 55].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-sm bg-[#2fc6f6]/80"
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
      <span className="absolute bottom-6 left-5 block h-3.5 w-1/2 rounded bg-white/70" />
    </span>
  )
}

function Stat({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('min-w-0 border-[#e6eaee] px-2', className)}>
      <dt className="truncate text-[11px] uppercase text-[#a8adb4]">{label}</dt>
      <dd className="mt-2 wrap-break-word text-xs leading-tight text-[#333] @lg:text-sm">
        {children}
      </dd>
    </div>
  )
}

function ScreenshotPlaceholder() {
  return (
    <span className="flex aspect-16/11 flex-col justify-center rounded-md border border-[#e3e7eb] bg-white px-2">
      <span className="flex h-3/5 overflow-hidden rounded-sm border border-[#eef0f2]">
        <span className="w-[14%] bg-[#2d3e50]" />
        <span className="flex-1 space-y-1.5 p-2">
          <span className="block h-1.5 w-full rounded-sm bg-[#2fc6f6]/70" />
          <span className="block h-1.5 w-2/3 rounded-sm bg-[#e9edf0]" />
          <span className="flex gap-1.5 pt-1">
            <span className="h-8 flex-1 rounded-sm bg-[#f1f4f6]" />
            <span className="h-8 flex-1 rounded-sm bg-[#f1f4f6]" />
          </span>
        </span>
      </span>
    </span>
  )
}
