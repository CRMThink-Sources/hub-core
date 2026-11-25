'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, PlusIcon, SearchIcon } from 'lucide-react'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PortalUser } from './access-group-card'
import { PermissionsUserAvatar } from './permissions-user-avatar'

const MIN_QUERY = 2
const DEBOUNCE_MS = 350

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; users: PortalUser[] }
  | { status: 'error'; message: string }

/**
 * Busca de pessoas no portal. A consulta vai ao Bitrix a cada termo, e não filtra uma
 * lista carregada antes: o `user.get` devolve só 50 por página.
 */
export function AccessGroupPeoplePicker(props: {
  selectedIds: string[]
  onAdd: (user: PortalUser) => void
}) {
  const { t } = useTranslation('thinkzap/grupos-acesso')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })

  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_QUERY) {
      setSearch({ status: 'idle' })
      return
    }
    setSearch({ status: 'loading' })
    // Resposta de um termo antigo não pode substituir a do atual.
    let stale = false
    const run = async () => {
      const resolved = resolveThinkzapClient()
      if (!resolved.ok) {
        setSearch({ status: 'error', message: resolved.message })
        return
      }
      try {
        const data = await resolved.client.get<{ users: PortalUser[] }>(
          '/thinkzap/portal-users',
          { params: { search: term } },
        )
        if (!stale) setSearch({ status: 'ready', users: data.users ?? [] })
      } catch (error) {
        if (!stale) {
          setSearch({
            status: 'error',
            message: thinkzapApiErrorMessage(error, t('searchError')),
          })
        }
      }
    }
    const handle = window.setTimeout(() => void run(), DEBOUNCE_MS)
    return () => {
      stale = true
      window.clearTimeout(handle)
    }
  }, [query, t])

  const selected = new Set(props.selectedIds)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('searchPeople')}
          aria-label={t('searchPeople')}
          autoComplete="off"
          className="pl-8"
        />
      </div>

      <div aria-live="polite">
        {search.status === 'idle' ? (
          <Hint>{t('searchHint')}</Hint>
        ) : search.status === 'loading' ? (
          <Hint>{t('searching')}</Hint>
        ) : search.status === 'error' ? (
          <Hint>{search.message}</Hint>
        ) : search.users.length === 0 ? (
          <Hint>{t('noUsers')}</Hint>
        ) : (
          <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
            {search.users.map(user => (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
              >
                <PermissionsUserAvatar label={user.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">
                    {user.name}
                  </span>
                  {user.position ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.position}
                    </span>
                  ) : null}
                </span>
                {selected.has(user.id) ? (
                  <span className="flex shrink-0 items-center gap-1 px-2 text-xs font-medium text-primary">
                    <CheckIcon className="size-3.5" />
                    {t('added')}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t('addNamed', { name: user.name })}
                    onClick={() => props.onAdd(user)}
                  >
                    <PlusIcon />
                    {t('add')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
