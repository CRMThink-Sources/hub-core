import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TimelineComments } from './timeline-comments'
import { ScheduleDetails } from './schedule-details'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const ScheduleView = () => {
  return (
    <section className="p-4">
      <Link href="/geolocation" className="flex items-center gap-2">
        <ArrowLeft className="w-5 h-5 text-amber-500" />
        Voltar
      </Link>

      <Tabs defaultValue="details" className="mt-4">
        <TabsList>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="comments">Comentários</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <ScheduleDetails />
        </TabsContent>
        <TabsContent value="comments">
          <TimelineComments />
        </TabsContent>
      </Tabs>
    </section>
  )
}
