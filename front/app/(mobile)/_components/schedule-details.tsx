import { Button } from '@/components/ui/button'
import { CalendarClock, Check, MapPin, X } from 'lucide-react'

export const ScheduleDetails = () => {
  const schedule = {
    id: 1,
    name: 'Agenda 1',
    description: 'Agenda 1 description',
    date: '2026-03-18 10:00:00',
    status: 'confirmed',
    address: 'Rua tadato ochikubo, 189, Sertaneja, PR',
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">Detalhes</h3>
      <div className="flex flex-col gap-2 mt-2 justify-around h-full">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-800">
              {schedule.address}
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-500" />
            <h4 className="text-sm font-semibold text-slate-800">
              {new Date(schedule.date).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </h4>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-2 justify-end">
          <Button variant="outline" className="w-full">
            <Check className="w-5 h-5 text-amber-500" />
            Check-in
          </Button>
          <Button variant="outline" className="w-full">
            <X className="w-5 h-5 text-amber-500" />
            Check-out
          </Button>
        </div>
      </div>
    </div>
  )
}
