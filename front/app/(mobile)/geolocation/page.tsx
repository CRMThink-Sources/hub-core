'use client'

import { BX24Script } from '@/bitrix/bx24-script'
import { useEffect, useState } from 'react'
import { Header } from '../_components/header'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ScheduleList } from '../_components/schedule-list'

export default function MobilePage() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        setLatitude(position.coords.latitude)
        setLongitude(position.coords.longitude)
        setAccuracy(position.coords.accuracy)
      },
    )
  }, [scriptLoaded])

  return (
    <div>
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      <Header />
      <main className="mt-16">
        <ScheduleList />
      </main>
    </div>
  )
}
