'use client'

import { Suspense } from 'react'
import { AudioWidgetProvider } from './_composition/audio-widget-provider'
import { AudioWidgetView } from './_composition/audio-widget-view'

function AudioWidgetPageContent() {
  return (
    <main className="h-full p-2 text-slate-900 sm:p-3">
      <AudioWidgetProvider>
        <AudioWidgetView />
      </AudioWidgetProvider>
    </main>
  )
}

export default function BitrixAudioImbotPage() {
  return (
    <Suspense fallback={<main className="h-full p-2 text-slate-900 sm:p-3" />}>
      <AudioWidgetPageContent />
    </Suspense>
  )
}
