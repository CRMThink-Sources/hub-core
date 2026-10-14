'use client'

import { useEffect, useRef, useState } from 'react'
import { tutorialTracks, type LpBaseContent, type Tutorial } from './content'
import type { AppAsideComponent, TutorialView } from './frame'
import { LpContentProvider } from './lp-content-context'
import type { LpCtas } from './resolve-ctas'
import {
  createTutorialHash,
  isTutorialHash,
  TUTORIALS_SECTION_ID,
  tutorialHash,
  type TutorialLocation,
} from './tutorial-hash'
import { TutorialPlayer } from './tutorial-player'

// `replaceState` troca a aba sem entrada no histórico nem salto de rolagem; o hash só é lido no cliente.
export function TutorialTabs<Slug extends string, AppMenu extends string>({
  content,
  tutorials: TUTORIALS,
  views,
  appAside,
  ctas,
}: {
  content: LpBaseContent
  tutorials: Tutorial<string, Slug>[]
  views: Record<Slug, TutorialView<string, AppMenu>>
  appAside: AppAsideComponent<AppMenu>
  ctas: LpCtas
}) {
  const { resolveTutorialHash } = createTutorialHash(TUTORIALS)
  const [location, setLocation] = useState<TutorialLocation<Slug>>({
    slug: TUTORIALS[0].slug,
    variant: '',
  })
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const syncWithHash = () => {
      const { hash } = window.location
      if (!isTutorialHash(hash)) return
      setLocation(resolveTutorialHash(hash))
      document
        .getElementById(TUTORIALS_SECTION_ID)
        ?.scrollIntoView({ block: 'start' })
    }
    syncWithHash()
    window.addEventListener('hashchange', syncWithHash)
    return () => window.removeEventListener('hashchange', syncWithHash)
  }, [])

  const go = (next: TutorialLocation<Slug>) => {
    setLocation(next)
    window.history.replaceState(null, '', tutorialHash(next.slug, next.variant))
  }

  const tutorialIndex = TUTORIALS.findIndex(item => item.slug === location.slug)
  const tutorial = TUTORIALS[tutorialIndex]
  const tracks = tutorialTracks(tutorial)
  const track = tracks.find(item => item.key === location.variant) ?? tracks[0]
  const nextTutorial = TUTORIALS[tutorialIndex + 1]

  return (
    <LpContentProvider content={content}>
      <div ref={topRef}>
        <TabStrip
          label={content.player.tabsLabel}
          items={TUTORIALS.map(item => ({
            id: item.slug,
            label: item.label,
            href: tutorialHash(item.slug),
          }))}
          active={tutorial.slug}
          onSelect={slug => go({ slug: slug as Slug, variant: '' })}
          idPrefix="tab"
        />

        <div
          role="tabpanel"
          id="tutorial-panel"
          aria-labelledby={`tab-${tutorial.slug}`}
          className="mt-6"
        >
          {tracks.length > 1 && (
            <TabStrip
              label={content.player.variantsLabel(tutorial.label)}
              items={tracks.map(item => ({
                id: item.key,
                label: item.label,
                href: tutorialHash(tutorial.slug, item.key),
              }))}
              active={track.key}
              onSelect={key => go({ slug: tutorial.slug, variant: key })}
              idPrefix={`subtab-${tutorial.slug}`}
              controls="tutorial-track"
              size="sm"
            />
          )}
          <div
            id="tutorial-track"
            {...(tracks.length > 1 && {
              role: 'tabpanel',
              'aria-labelledby': `subtab-${tutorial.slug}-${track.key}`,
            })}
          >
            <p className="mb-8 mt-4 text-center text-sm text-muted-foreground">
              {track.summary}
            </p>
            <TutorialPlayer
              key={`${tutorial.slug}:${track.key}`}
              track={track}
              view={views[tutorial.slug]}
              appAside={appAside}
              ctas={ctas}
              next={
                nextTutorial && {
                  label: nextTutorial.label,
                  onGo: () => {
                    go({ slug: nextTutorial.slug, variant: '' })
                    document.getElementById(`tab-${nextTutorial.slug}`)?.focus()
                    topRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                  },
                }
              }
            />
          </div>
        </div>
      </div>
    </LpContentProvider>
  )
}

type TabItem = { id: string; label: string; href: string }

function TabStrip({
  label,
  items,
  active,
  onSelect,
  idPrefix,
  controls = 'tutorial-panel',
  size = 'md',
}: {
  label: string
  items: TabItem[]
  active: string
  onSelect: (id: string) => void
  idPrefix: string
  controls?: string
  size?: 'md' | 'sm'
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>())

  // Mexe só na faixa: `scrollIntoView` rolaria a página junto.
  useEffect(() => {
    const strip = stripRef.current
    const tab = tabRefs.current.get(active)
    if (!strip || !tab) return
    strip.scrollTo({
      left: tab.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2,
      behavior: 'smooth',
    })
  }, [active])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = items.findIndex(item => item.id === active)
    const last = items.length - 1
    const target = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const id = items[target].id
    onSelect(id)
    tabRefs.current.get(id)?.focus()
  }

  const shape =
    size === 'md'
      ? 'px-4 py-2 text-sm font-semibold'
      : 'px-3 py-1.5 text-xs font-medium'

  return (
    <div
      ref={stripRef}
      className="overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="mx-auto flex w-max gap-2"
      >
        {items.map(item => {
          const selected = item.id === active
          return (
            <a
              key={item.id}
              ref={node => {
                if (node) tabRefs.current.set(item.id, node)
                else tabRefs.current.delete(item.id)
              }}
              href={item.href}
              role="tab"
              id={`${idPrefix}-${item.id}`}
              aria-selected={selected}
              aria-controls={controls}
              tabIndex={selected ? 0 : -1}
              onClick={event => {
                event.preventDefault()
                onSelect(item.id)
              }}
              className={`shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${shape} ${
                selected
                  ? size === 'md'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-primary bg-accent text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {item.label}
            </a>
          )
        })}
      </div>
    </div>
  )
}
