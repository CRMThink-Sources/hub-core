'use client'

import { Suspense } from 'react'
import { ButtonWidgetRoot } from './_composition/button-widget-provider'
import { ButtonWidgetView } from './_composition/button-widget-view'
import { ButtonWidgetLoading } from './button-widget-loading'

function ButtonWidgetPageContent() {
  return (
    <main className="h-full p-2 text-slate-900 sm:p-3">
      <ButtonWidgetRoot>
        <ButtonWidgetView />
      </ButtonWidgetRoot>
    </main>
  )
}

export function ButtonWidgetPageClient() {
  return (
    <Suspense fallback={<ButtonWidgetLoading />}>
      <ButtonWidgetPageContent />
    </Suspense>
  )
}
