'use client'

import * as React from 'react'
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ComboboxOption = {
  value: string
  label: string
  /** Subtítulo opcional exibido em letra menor abaixo do label. */
  description?: string
}

function Combobox(props: ComboboxPrimitive.Root.Props<ComboboxOption>) {
  return <ComboboxPrimitive.Root data-slot="combobox" {...props} />
}

function ComboboxTrigger({
  className,
  placeholder,
  ...props
}: ComboboxPrimitive.Trigger.Props & { placeholder?: string }) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'data-[popup-open]:border-ring focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <ComboboxPrimitive.Value>
        {(value: ComboboxOption | null) =>
          value ? (
            <span className="truncate">{value.label}</span>
          ) : (
            <span className="truncate text-muted-foreground">
              {placeholder ?? 'Selecione…'}
            </span>
          )
        }
      </ComboboxPrimitive.Value>
      <ComboboxPrimitive.Icon className="text-muted-foreground">
        <ChevronsUpDownIcon className="size-4 shrink-0" />
      </ComboboxPrimitive.Icon>
    </ComboboxPrimitive.Trigger>
  )
}

function ComboboxContent({
  className,
  children,
  searchPlaceholder = 'Buscar…',
  emptyText = 'Nenhum resultado.',
  sideOffset = 6,
}: {
  className?: string
  children: (item: ComboboxOption, index: number) => React.ReactNode
  searchPlaceholder?: string
  emptyText?: string
  sideOffset?: number
}) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        sideOffset={sideOffset}
        className="z-50 outline-none"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            'flex max-h-[min(22rem,var(--available-height))] w-[var(--anchor-width)] min-w-[12rem] flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
            'origin-[var(--transform-origin)] transition-[transform,opacity] data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
            className,
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-2.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <ComboboxPrimitive.Input
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ComboboxPrimitive.List className="overflow-y-auto p-1 empty:p-0">
            {children}
          </ComboboxPrimitive.List>
          <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-muted-foreground empty:hidden empty:p-0">
            {emptyText}
          </ComboboxPrimitive.Empty>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 flex-col">{children}</span>
      <ComboboxPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <CheckIcon className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

export { Combobox, ComboboxTrigger, ComboboxContent, ComboboxItem }
