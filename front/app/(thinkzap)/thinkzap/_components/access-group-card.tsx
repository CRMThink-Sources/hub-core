'use client'

import { useTranslation } from 'react-i18next'
import {
  Building2Icon,
  PencilIcon,
  PhoneIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  describeDepartment,
  type AccessGroup,
  type PortalDepartment,
} from '@/shared/thinkzap/access-group-draft'
import { PermissionsUserAvatar } from './permissions-user-avatar'

export type PortalUser = {
  id: string
  name: string
  position?: string
  /** `false` = desativado no Bitrix24. */
  active?: boolean
}

const MAX_AVATARS = 5

type Props = {
  group: AccessGroup
  users: ReadonlyMap<string, PortalUser>
  /** `null` = a lista do portal não carregou. */
  departments: PortalDepartment[] | null
  /** Só as linhas que a tela oferece; as demais não aparecem. */
  lineNameById: ReadonlyMap<string, string>
  confirmingDelete: boolean
  busy: boolean
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}

export function AccessGroupCard(props: Props) {
  const { t } = useTranslation('thinkzap/grupos-acesso')
  const { group } = props

  const members = group.memberIds.map(
    id => props.users.get(id) ?? { id, name: t('unknownUser', { id }) },
  )
  const inactive = members.filter(member => member.active === false)
  const groupDepartments = group.departments ?? []
  const lineNames = group.lineIds.flatMap(id => {
    const name = props.lineNameById.get(id)
    return name ? [name] : []
  })
  const nobody = members.length === 0 && groupDepartments.length === 0

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <header className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-semibold break-words text-foreground">
          {group.name}
        </h3>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('editNamed', { name: group.name })}
            title={t('edit')}
            onClick={props.onEdit}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('deleteNamed', { name: group.name })}
            title={t('delete')}
            onClick={props.onAskDelete}
          >
            <Trash2Icon />
          </Button>
        </div>
      </header>

      {nobody ? (
        <Warning>{t('nobodyWarning')}</Warning>
      ) : (
        <div className="flex flex-col gap-3">
          {members.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center -space-x-1" aria-hidden>
                {members.slice(0, MAX_AVATARS).map(member => (
                  <span
                    key={member.id}
                    title={member.name}
                    className={`rounded-full bg-card ring-2 ring-card ${
                      member.active === false ? 'opacity-40' : ''
                    }`}
                  >
                    <PermissionsUserAvatar label={member.name} size="sm" />
                  </span>
                ))}
                {members.length > MAX_AVATARS ? (
                  <span className="relative flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card">
                    +{members.length - MAX_AVATARS}
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {members.map(member => member.name).join(', ')}
              </p>
              {inactive.length > 0 ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {t('inactiveList', {
                    names: inactive.map(member => member.name).join(', '),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          {groupDepartments.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {groupDepartments.map(item => {
                const info = describeDepartment(
                  item.departmentId,
                  props.departments,
                )
                const label =
                  info.status === 'found'
                    ? info.name
                    : t(
                        info.status === 'missing'
                          ? 'missingDepartment'
                          : 'unknownDepartment',
                        { id: item.departmentId },
                      )
                return (
                  <li
                    key={item.departmentId}
                    title={info.status === 'found' ? info.path : undefined}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    <Building2Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                    {item.includeSubdepartments ? (
                      <span className="shrink-0 font-normal opacity-80">
                        · {t('withSubdepartments')}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      )}

      <footer className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
        {lineNames.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={t('linesTitle')}>
            {lineNames.map((name, index) => (
              <li
                key={`${name}-${index}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-foreground"
              >
                <PhoneIcon className="size-3 shrink-0 text-muted-foreground" />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Warning>{t('noLinesWarning')}</Warning>
        )}

        {props.confirmingDelete ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-end gap-2"
          >
            <span className="mr-auto text-sm text-foreground">
              {t('deleteQuestion')}
            </span>
            <Button variant="outline" size="sm" onClick={props.onCancelDelete}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={props.busy}
              onClick={props.onDelete}
            >
              {t('confirmDelete')}
            </Button>
          </div>
        ) : null}
      </footer>
    </article>
  )
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
