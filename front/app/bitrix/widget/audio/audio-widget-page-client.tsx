'use client'

import { Suspense } from 'react'
import { AudioWidgetRoot } from './_composition/audio-widget-provider'
import { AudioWidgetView } from './_composition/audio-widget-view'
import { AudioWidgetLoading } from './audio-widget-loading'

function AudioWidgetPageContent() {
  return (
    <main className="h-full p-2 text-slate-900 sm:p-3">
      <AudioWidgetRoot>
        <AudioWidgetView />
      </AudioWidgetRoot>
    </main>
  )
}

export function AudioWidgetPageClient() {
  return (
    <Suspense fallback={<AudioWidgetLoading />}>
      <AudioWidgetPageContent />
    </Suspense>
  )
}
