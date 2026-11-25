'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2Icon, CheckIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  listDepartments,
  type AccessGroupDepartment,
  type PortalDepartment,
} from '@/shared/thinkzap/access-group-draft'

/**
 * Escolha de departamentos. Ao adicionar, a linha se abre para perguntar se os
 * subdepartamentos entram junto (desmarcado por padrão); a escolha continua editável
 * na relação de quem tem acesso.
 */
export function AccessGroupDepartmentPicker(props: {
  /** `null` = a lista do portal não carregou. */
  departments: PortalDepartment[] | null
  selected: AccessGroupDepartment[]
  onAdd: (departmentId: string, includeSubdepartments: boolean) => void
  onRetry: () => void
}) {
  const { t } = useTranslation('thinkzap/grupos-acesso')
  const [query, setQuery] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [includeSubdepartments, setIncludeSubdepartments] = useState(false)

  const listed = useMemo(
    () => listDepartments(props.departments ?? [], query),
    [props.departments, query],
  )
  const selected = new Set(props.selected.map(d => d.departmentId))

  if (!props.departments) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg bg-amber-50 px-4 py-4 text-center text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <p>{t('departmentsUnavailable')}</p>
        <Button variant="outline" size="sm" onClick={props.onRetry}>
          {t('retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('searchDepartment')}
          aria-label={t('searchDepartment')}
          autoComplete="off"
          className="pl-8"
        />
      </div>

      {listed.length === 0 ? (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
          {t('noDepartments')}
        </p>
      ) : (
        <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
          {listed.map(department => (
            <li
              key={department.id}
              className={`rounded-lg px-2 py-1.5 ${
                pendingId === department.id ? 'bg-muted' : 'hover:bg-muted'
              }`}
            >
              <div
                className="flex items-center gap-3"
                style={{ paddingLeft: `${department.depth * 1}rem` }}
              >
                <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">
                    {department.name}
                  </span>
                  {query.trim() ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {department.path}
                    </span>
                  ) : null}
                </span>
                {selected.has(department.id) ? (
                  <span className="flex shrink-0 items-center gap-1 px-2 text-xs font-medium text-primary">
                    <CheckIcon className="size-3.5" />
                    {t('added')}
                  </span>
                ) : pendingId === department.id ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t('addNamed', { name: department.name })}
                    onClick={() => {
                      setPendingId(department.id)
                      setIncludeSubdepartments(false)
                    }}
                  >
                    <PlusIcon />
                    {t('add')}
                  </Button>
                )}
              </div>

              {pendingId === department.id && !selected.has(department.id) ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                  <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      autoFocus
                      checked={includeSubdepartments}
                      onCheckedChange={checked =>
                        setIncludeSubdepartments(checked === true)
                      }
                    />
                    {t('includeSubdepartments')}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingId('')}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      props.onAdd(department.id, includeSubdepartments)
                      setPendingId('')
                    }}
                  >
                    {t('confirmAdd')}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
