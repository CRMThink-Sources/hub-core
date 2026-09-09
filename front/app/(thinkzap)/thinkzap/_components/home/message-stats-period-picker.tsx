'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  clampRangeEnd,
  fromDateInputValue,
  maxRangeEnd,
  toDateInputValue,
} from '../../_lib/home-message-stats-range'

type Props = {
  from: Date
  to: Date
  onChange: (range: { from: Date; to: Date }) => void
}

/**
 * Seletor de período da home, com o limite de 6 meses aplicado nos dois
 * sentidos: mudar `from` para trás corta `to` se ele ficar fora da janela, e o
 * `max` do input de `to` já não deixa escolher além do limite.
 *
 * O corte acontece aqui, antes de qualquer chamada à API — a validação do
 * servidor continua sendo a autoridade, esta é só a experiência do usuário.
 */
export function MessageStatsPeriodPicker({ from, to, onChange }: Props) {
  const maxTo = maxRangeEnd(from)

  function handleFromChange(value: string) {
    const nextFrom = fromDateInputValue(value)
    onChange({ from: nextFrom, to: clampRangeEnd(nextFrom, to) })
  }

  function handleToChange(value: string) {
    onChange({ from, to: fromDateInputValue(value) })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="home-stats-from">De</Label>
          <Input
            id="home-stats-from"
            type="date"
            value={toDateInputValue(from)}
            max={toDateInputValue(to)}
            onChange={event => handleFromChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="home-stats-to">Até</Label>
          <Input
            id="home-stats-to"
            type="date"
            value={toDateInputValue(to)}
            min={toDateInputValue(from)}
            max={toDateInputValue(maxTo)}
            onChange={event => handleToChange(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Período máximo de 6 meses</p>
    </div>
  )
}
