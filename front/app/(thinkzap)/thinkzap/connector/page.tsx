'use client'

import { ContactCenterView } from '@/components/layouts/widgets/contact-center'
import { BX24Script } from '@/bitrix/bx24-script'
import { useEffect, useState } from 'react'

export default function BitrixWidgetPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  useEffect(() => {
    if (scriptLoaded) {
      console.log('scriptLoaded')
    }
  }, [scriptLoaded])
  return (
    <div>
      <BX24Script
        onLoad={() => {
          setScriptLoaded(true)
        }}
      />
      <ContactCenterView scriptLoaded={scriptLoaded} />
    </div>
  )
}
