'use client'

import dynamic from 'next/dynamic'
import { ButtonWidgetLoading } from './button-widget-loading'

const ButtonWidgetPageClient = dynamic(
  () =>
    import('./button-widget-page-client').then(m => m.ButtonWidgetPageClient),
  {
    ssr: false,
    loading: () => <ButtonWidgetLoading />,
  },
)

export default function BitrixButtonImbotPage() {
  return <ButtonWidgetPageClient />
}
