'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2, Plus, X } from 'lucide-react'
import { axiosPortal } from '@/infra/client/axios-portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import type { ListPortalUsersResponse } from '@/lib/portal-users'
import { AdminUsersTable } from './admin-users-table'

type CreateUserResult = {
  id: string
  email: string
  name: string
  role: string
}

export function AdminUsersPage() {
  const { t } = useTranslation('admin/usuarios')
  const { t: tCommon } = useTranslation('common')

  const [data, setData] = useState<ListPortalUsersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [reloadCounter, setReloadCounter] = useState(0)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setHasError(false)

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '10',
        })
        if (debouncedSearch) params.set('search', debouncedSearch)

        const result = await axiosPortal().get<ListPortalUsersResponse>(
          `/portal/users?${params.toString()}`,
        )
        if (!cancelled) {
          setData(result)
        }
      } catch {
        if (!cancelled) {
          setHasError(true)
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, reloadCounter])

  function reload() {
    setReloadCounter(c => c + 1)
    setPage(1)
  }

  function openCreateForm() {
    setShowCreateForm(true)
    setCreateError(null)
    setCreateSuccess(null)
    setEmail('')
    setName('')
    setPassword('')
    setConfirmPassword('')
  }

  function closeCreateForm() {
    setShowCreateForm(false)
    setCreateError(null)
    setCreateSuccess(null)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)

    if (password !== confirmPassword) {
      setCreateError(t('errorPasswordMismatch'))
      return
    }

    setIsCreating(true)

    try {
      const result = await axiosPortal().post<CreateUserResult>(
        '/portal/users',
        { email, name, password },
      )
      setCreateSuccess(t('successDescription', { email: result.email }))
      setEmail('')
      setName('')
      setPassword('')
      setConfirmPassword('')
      reload()
    } catch (err: unknown) {
      const apiError = (
        err as { response?: { data?: { result?: { error?: string } } } }
      )?.response?.data?.result?.error

      if (apiError === 'E-mail já cadastrado') {
        setCreateError(t('errorEmailTaken'))
      } else {
        setCreateError(t('errorGeneric'))
      }
    } finally {
      setIsCreating(false)
    }
  }

  const meta = data?.meta
  const users = data?.users ?? []
  const isEmpty = !isLoading && !hasError && users.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('description')}</p>
        </div>
        {!showCreateForm && (
          <Button onClick={openCreateForm}>
            <Plus className="size-4" />
            {t('addUser')}
          </Button>
        )}
      </div>

      {showCreateForm && (
        <div className="admin-card p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium text-foreground">
              {t('formTitle')}
            </h2>
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              onClick={closeCreateForm}
              aria-label={t('cancelCreate')}
            >
              <X className="size-4" />
            </button>
          </div>

          <form
            onSubmit={event => {
              void handleCreate(event)
            }}
            className="max-w-md space-y-6"
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">{t('emailLabel')}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder={t('emailPlaceholder')}
                  disabled={isCreating}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="name">{t('nameLabel')}</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder={t('namePlaceholder')}
                  disabled={isCreating}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">{t('passwordLabel')}</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    disabled={isCreating}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={
                      showPassword ? t('hidePassword') : t('showPassword')
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  {t('confirmPasswordLabel')}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    placeholder={t('confirmPasswordPlaceholder')}
                    disabled={isCreating}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm(v => !v)}
                    aria-label={
                      showConfirm ? t('hidePassword') : t('showPassword')
                    }
                  >
                    {showConfirm ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </Field>

              {createError ? <FieldError>{createError}</FieldError> : null}

              {createSuccess ? (
                <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                  {createSuccess}
                </p>
              ) : null}
            </FieldGroup>

            <div className="flex gap-3">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('submitting')}
                  </>
                ) : (
                  t('submit')
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateForm}
                disabled={isCreating}
              >
                {t('cancelCreate')}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div>
        <Input
          type="search"
          placeholder={t('search')}
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{tCommon('carregando')}</p>
      ) : hasError ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('errorTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('errorDescription')}
          </p>
          <Button variant="outline" className="mt-4" onClick={reload}>
            {t('retry')}
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="admin-card p-6">
          <h2 className="text-lg font-medium text-foreground">
            {t('emptyTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {debouncedSearch ? t('emptyDescription') : t('emptyDefault')}
          </p>
          {!debouncedSearch && !showCreateForm && (
            <Button className="mt-4" onClick={openCreateForm}>
              <Plus className="size-4" />
              {t('addUser')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <AdminUsersTable users={users} />

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('page', {
                  current: meta.page,
                  total: meta.totalPages,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  {t('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
