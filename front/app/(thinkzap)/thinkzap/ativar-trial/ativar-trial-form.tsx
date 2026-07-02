'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'
import { envConfig } from '@/shared/infra/env-config'
import { useTranslation } from 'react-i18next'
import { Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AtivarTrialForm() {
  const { t } = useTranslation('thinkzap/ativar-trial')
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    const resolved = resolveThinkzapClient()
    if (!resolved.ok) {
      setErro(resolved.message)
      return
    }

    setSubmitting(true)
    try {
      const data = await resolved.client.post<{ clientSecret?: string | null }>(
        '/thinkzap/subscription/activate-trial',
        {
          name: nome.trim(),
          email: email.trim(),
          phone: telefone.trim(),
          company: empresa.trim(),
        },
      )

      router.push(`/thinkzap/conexoes`)
    } catch (e: unknown) {
      setErro(thinkzapApiErrorMessage(e, t('erroIniciarTrial')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <form
        onSubmit={e => {
          void handleSubmit(e)
        }}
        className="space-y-5"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="trial-nome">{t('campos.nome')}</Label>
          <Input
            id="trial-nome"
            name="nome"
            type="text"
            autoComplete="name"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder={t('campos.nomePlaceholder')}
            required
            minLength={2}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="trial-email">{t('campos.email')}</Label>
          <Input
            id="trial-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('campos.emailPlaceholder')}
            required
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="trial-telefone">{t('campos.telefone')}</Label>
          <Input
            id="trial-telefone"
            name="telefone"
            type="tel"
            autoComplete="tel"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder={t('campos.telefonePlaceholder')}
            required
            minLength={8}
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="trial-empresa">{t('campos.empresa')}</Label>
          <Input
            id="trial-empresa"
            name="empresa"
            type="text"
            autoComplete="organization"
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
            placeholder={t('campos.empresaPlaceholder')}
            required
            minLength={2}
            disabled={submitting}
          />
        </div>

        {erro && (
          <div
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {erro}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2Icon className="animate-spin" />
              {t('redirecionando')}
            </>
          ) : (
            t('continuar')
          )}
        </Button>
      </form>
    </div>
  )
}
