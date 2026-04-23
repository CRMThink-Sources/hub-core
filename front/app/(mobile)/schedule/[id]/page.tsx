'use client'
import { Header } from '@/app/(mobile)/_components/header'
import { use } from 'react'
import { ScheduleView } from '../../_components/schedule-view'

interface SchedulePageProps {
  params: Promise<{ id: string }>
}

export default function SchedulePage({ params }: SchedulePageProps) {
  const { id } = use(params)

  return (
    <>
      <Header />
      <main className="mt-16 bg-slate-100 min-h-screen">
        <ScheduleView />
      </main>
    </>
  )
}
