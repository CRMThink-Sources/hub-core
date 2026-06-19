'use client'

import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  type ComboboxOption,
} from '@/components/ui/combobox'
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
  const items: ComboboxOption[] = options.map(o => ({
    value: o.code,
    label: o.name,
  }))
  const selected = items.find(i => i.value === value) ?? null

  return (
    // key remonta quando a lista carrega: o Combobox não reflete troca de
    // `items` na mesma instância.
    <Combobox
      key={`${items.length}:${items[0]?.value ?? ''}`}
      items={items}
      value={selected}
      onValueChange={(v: ComboboxOption | null) => onChange(v?.value ?? null)}
    >
      <ComboboxTrigger placeholder={placeholder} />
      <ComboboxContent>
        {(item: ComboboxOption) => (
          <ComboboxItem key={item.value} value={item}>
            <span className="truncate">{item.label}</span>
          </ComboboxItem>
        )}
      </ComboboxContent>
    </Combobox>
  )
}
