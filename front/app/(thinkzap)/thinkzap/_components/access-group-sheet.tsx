'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2Icon, CheckIcon, PhoneIcon, XIcon } from 'lucide-react'
import { thinkzapApiErrorMessage } from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  addDepartment,
  addMember,
  createDraft,
  describeDepartment,
  isDraftDirty,
  removeDepartment,
  removeMember,
  setIncludeSubdepartments,
  toGroupPayload,
  toggleLine,
  type AccessGroup,
  type PortalDepartment,
} from '@/shared/thinkzap/access-group-draft'
import type { PortalUser } from './access-group-card'
import { AccessGroupDepartmentPicker } from './access-group-department-picker'
import { AccessGroupPeoplePicker } from './access-group-people-picker'
import { PermissionsUserAvatar } from './permissions-user-avatar'

type Props = {
  /** `null` = grupo novo. */
  group: AccessGroup | null
  /** Primeiro grupo da instalação: salvar passa a restringir todo mundo. */
  isFirstGroup: boolean
  lines: Array<{ id: string; name: string }>
  users: ReadonlyMap<string, PortalUser>
  departments: PortalDepartment[] | null
  onUserPicked: (user: PortalUser) => void
  onRetryDepartments: () => void
  /** Rejeita quando o salvamento falha; o painel fica aberto e mostra o motivo. */
  onSave: (payload: ReturnType<typeof toGroupPayload>) => Promise<void>
  onClose: () => void
}

/** Painel lateral de criação e edição. Montado por edição: o rascunho nasce aqui. */
export function AccessGroupSheet(props: Props) {
  const { t } = useTranslation('thinkzap/grupos-acesso')
  const [original] = useState(() =>
    createDraft(
      props.group,
      props.lines.map(line => line.id),
    ),
  )
  const [draft, setDraft] = useState(original)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)

  const total = draft.memberIds.length + draft.departments.length

  function requestClose() {
    if (saving) return
    if (isDraftDirty(draft, original)) {
      setConfirmingDiscard(true)
      return
    }
    props.onClose()
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      await props.onSave(toGroupPayload(draft))
    } catch (error) {
      setSaveError(thinkzapApiErrorMessage(error, t('saveError')))
      setSaving(false)
    }
  }

  return (
    <Sheet
      open
      onOpenChange={open => {
        if (!open) requestClose()
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <SheetTitle className="text-base font-semibold">
              {props.group ? t('editGroup') : t('newGroup')}
            </SheetTitle>
            <SheetDescription>{t('sheetDescription')}</SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('close')}
            onClick={requestClose}
          >
            <XIcon />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          {props.isFirstGroup ? (
            <p
              role="alert"
              className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {t('firstGroupWarning')}
            </p>
          ) : null}

          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">
              {t('nameLabel')}
            </span>
            <Input
              value={draft.name}
              maxLength={191}
              onChange={event =>
                setDraft({ ...draft, name: event.target.value })
              }
              placeholder={t('namePlaceholder')}
              autoComplete="off"
            />
          </label>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">
              {t('accessTitle', { total })}
            </h3>

            {total === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                {t('accessEmpty')}
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg bg-muted/50 p-2">
                {draft.departments.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {draft.departments.map(item => {
                      const info = describeDepartment(
                        item.departmentId,
                        props.departments,
                      )
                      const name =
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
                          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                        >
                          <Building2Icon className="size-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-sm font-medium text-foreground"
                              title={
                                info.status === 'found' ? info.path : undefined
                              }
                            >
                              {name}
                            </span>
                            <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                              <Switch
                                checked={item.includeSubdepartments}
                                onCheckedChange={checked =>
                                  setDraft(current =>
                                    setIncludeSubdepartments(
                                      current,
                                      item.departmentId,
                                      checked,
                                    ),
                                  )
                                }
                              />
                              {t('includeSubdepartments')}
                            </label>
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('removeNamed', { name })}
                            onClick={() =>
                              setDraft(current =>
                                removeDepartment(current, item.departmentId),
                              )
                            }
                          >
                            <XIcon />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}

                {draft.memberIds.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {draft.memberIds.map(id => {
                      const user = props.users.get(id)
                      const name = user?.name ?? t('unknownUser', { id })
                      return (
                        <li
                          key={id}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pr-1 pl-0.5 text-sm text-foreground"
                        >
                          <PermissionsUserAvatar label={name} size="sm" />
                          <span className="truncate">{name}</span>
                          {user?.active === false ? (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {t('inactive')}
                            </span>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="rounded-full"
                            aria-label={t('removeNamed', { name })}
                            onClick={() =>
                              setDraft(current => removeMember(current, id))
                            }
                          >
                            <XIcon />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )}

            <Tabs defaultValue="people">
              <TabsList className="w-full">
                <TabsTrigger value="people">{t('peopleTab')}</TabsTrigger>
                <TabsTrigger value="departments">
                  {t('departmentsTab')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="people">
                <AccessGroupPeoplePicker
                  selectedIds={draft.memberIds}
                  onAdd={user => {
                    props.onUserPicked(user)
                    setDraft(current => addMember(current, user.id))
                  }}
                />
              </TabsContent>
              <TabsContent value="departments">
                <AccessGroupDepartmentPicker
                  departments={props.departments}
                  selected={draft.departments}
                  onRetry={props.onRetryDepartments}
                  onAdd={(departmentId, include) =>
                    setDraft(current =>
                      addDepartment(current, departmentId, include),
                    )
                  }
                />
              </TabsContent>
            </Tabs>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">
              {t('linesLabel', { count: draft.lineIds.length })}
            </h3>
            {props.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noLines')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {props.lines.map(line => {
                  const selected = draft.lineIds.includes(line.id)
                  return (
                    <button
                      key={line.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setDraft(current => toggleLine(current, line.id))
                      }
                      className={`inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                        selected
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {selected ? (
                        <CheckIcon className="size-4 shrink-0" />
                      ) : (
                        <PhoneIcon className="size-4 shrink-0" />
                      )}
                      <span className="truncate">{line.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          {confirmingDiscard ? (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-end gap-2"
            >
              <span className="mr-auto text-sm text-foreground">
                {t('discardQuestion')}
              </span>
              <Button
                variant="outline"
                autoFocus
                onClick={() => setConfirmingDiscard(false)}
              >
                {t('keepEditing')}
              </Button>
              <Button variant="destructive" onClick={props.onClose}>
                {t('discard')}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={saving}
                onClick={requestClose}
              >
                {t('cancel')}
              </Button>
              <Button
                disabled={saving || !draft.name.trim()}
                onClick={() => void handleSave()}
              >
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
