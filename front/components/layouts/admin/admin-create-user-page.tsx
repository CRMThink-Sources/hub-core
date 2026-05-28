'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { axiosPortal } from '@/infra/client/axios-portal'

type CreateUserResult = {
  id: string
  email: string
  name: string
  role: string
}

export function AdminCreateUserPage() {
  const { t } = useTranslation('admin/usuarios')

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError(t('errorPasswordMismatch'))
      return
    }

    setLoading(true)

    try {
      const result = await axiosPortal().post<CreateUserResult>(
        '/portal/users',
        { email, name, password },
      )
      setSuccess(t('successDescription', { email: result.email }))
      setEmail('')
      setName('')
      setPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const apiError = (
        err as { response?: { data?: { result?: { error?: string } } } }
      )?.response?.data?.result?.error

      if (apiError === 'E-mail já cadastrado') {
        setError(t('errorEmailTaken'))
      } else {
        setError(t('errorGeneric'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('description')}</p>
      </div>

      <div className="admin-card p-6">
        <h2 className="mb-6 text-lg font-medium text-foreground">
          {t('formTitle')}
        </h2>

        <form
          onSubmit={event => {
            void handleSubmit(event)
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
                disabled={loading}
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
                disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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

            {error ? <FieldError>{error}</FieldError> : null}

            {success ? (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                {success}
              </p>
            ) : null}
          </FieldGroup>

          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
