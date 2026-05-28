'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { portalLogin } from '@/infra/client/axios-portal'
import { setPortalToken } from '@/lib/portal-auth'
import { usePortalSession } from '@/providers/portal-session-provider'

export function AdminLoginForm() {
  const { t } = useTranslation('admin/login')
  const router = useRouter()
  const { refreshSession } = usePortalSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { token } = await portalLogin(email, password)
      setPortalToken(token)
      await refreshSession()
      router.replace('/admin')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { result?: { error?: string } } } })
          ?.response?.data?.result?.error ??
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        t('errorGeneric')
      setError(typeof message === 'string' ? message : t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

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
          <FieldLabel htmlFor="password">{t('passwordLabel')}</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={t('passwordPlaceholder')}
              disabled={loading}
              className="pr-10"
            />
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </Field>

        {error ? <FieldError>{error}</FieldError> : null}
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={loading}>
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
  )
}
