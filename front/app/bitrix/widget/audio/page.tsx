'use client'

import dynamic from 'next/dynamic'
import { AudioWidgetLoading } from './audio-widget-loading'

const AudioWidgetPageClient = dynamic(
  () => import('./audio-widget-page-client').then(m => m.AudioWidgetPageClient),
  {
    ssr: false,
    loading: () => <AudioWidgetLoading />,
  },
)

export default function BitrixAudioImbotPage() {
  return <AudioWidgetPageClient />
}
