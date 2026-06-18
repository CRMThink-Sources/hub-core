'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Option } from './types'

type Props = {
  options: Option[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
}

export function OptionSelect({
  options,
  value,
  onChange,
  placeholder = 'Selecione…',
}: Props) {
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue>
          {(v: string) => {
            const opt = options.find(o => o.code === v)
            return opt ? (
              opt.name
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            Nenhuma opção
          </div>
        ) : (
          options.map(o => (
            <SelectItem key={o.code} value={o.code}>
              {o.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
