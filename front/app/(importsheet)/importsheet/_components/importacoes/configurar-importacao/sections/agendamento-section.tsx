import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ScheduleType } from '../../../types'
import { SCHEDULE_OPTIONS, WEEKDAYS } from '../constants'

type Props = {
  scheduleManual: boolean
  setScheduleManual: (value: boolean) => void
  scheduleType: ScheduleType
  setScheduleType: (value: ScheduleType) => void
  everyHours: number
  setEveryHours: (value: number) => void
  weekdays: number[]
  toggleWeekday: (day: number) => void
}

export function AgendamentoSection({
  scheduleManual,
  setScheduleManual,
  scheduleType,
  setScheduleType,
  everyHours,
  setEveryHours,
  weekdays,
  toggleWeekday,
}: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      <span className="text-sm font-medium text-foreground">Agendamento</span>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label>Frequência</Label>
          <Select
            value={scheduleType}
            disabled={scheduleManual}
            onValueChange={(v: string | null) =>
              setScheduleType((v ?? 'hours') as ScheduleType)
            }
          >
            <SelectTrigger>
              <SelectValue>
                {(value: string) =>
                  SCHEDULE_OPTIONS.find(o => o.value === value)?.label ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scheduleType === 'hours' ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-hours">A cada (horas)</Label>
            <Input
              id="schedule-hours"
              type="number"
              min={1}
              max={23}
              disabled={scheduleManual}
              value={everyHours}
              onChange={e =>
                setEveryHours(
                  Math.min(23, Math.max(1, Number(e.target.value) || 1)),
                )
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label>Dias da semana</Label>
            <div
              className={`flex flex-wrap gap-1.5 ${
                scheduleManual ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              {WEEKDAYS.map(d => {
                const on = weekdays.includes(d.value)
                return (
                  <button
                    key={d.value}
                    type="button"
                    disabled={scheduleManual}
                    onClick={() => toggleWeekday(d.value)}
                    className={`h-9 w-11 cursor-pointer rounded-md border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-foreground hover:bg-accent'
                    }`}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2">
        <Switch checked={scheduleManual} onCheckedChange={setScheduleManual} />
        <span className="text-sm text-foreground">Manual?</span>
      </label>
      {scheduleManual && (
        <p className="text-xs text-muted-foreground">
          Agendamento desativado — a importação roda sob demanda pela lista de
          importações criadas.
        </p>
      )}
    </div>
  )
}
