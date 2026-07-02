'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreatedGroup } from '@/app/hooks/use-create-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  group: CreatedGroup
  onCreateAnother: () => void
  onViewList?: () => void
}

export function GrupoCriadoSucesso({
  group,
  onCreateAnother,
  onViewList,
}: Props) {
  const { t } = useTranslation('thinkzap/configuracoes/criar-grupo')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(group.invitationLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.getElementById(
        'invitation-link-input',
      ) as HTMLInputElement | null
      if (input) {
        input.select()
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-primary/30 bg-primary/5 p-6">
      <h3 className="text-lg font-semibold text-primary">
        {t('sucesso.titulo')}
      </h3>

      <div className="flex flex-col gap-2">
        <Label>{t('sucesso.linkLabel')}</Label>
        <div className="flex gap-2">
          <Input
            id="invitation-link-input"
            readOnly
            value={group.invitationLink}
            className="min-w-0 flex-1 bg-card"
          />
          <Button
            type="button"
            onClick={() => void handleCopy()}
            className="shrink-0"
          >
            {copied ? t('sucesso.copiado') : t('sucesso.copiar')}
          </Button>
        </div>
      </div>

      {group.phone && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{t('sucesso.grupoId')}:</span>{' '}
          {group.phone}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onViewList && (
          <Button type="button" onClick={onViewList}>
            {t('sucesso.verLista', { defaultValue: 'Ver na lista' })}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onCreateAnother}
          className="w-fit"
        >
          {t('sucesso.criarOutro')}
        </Button>
      </div>
    </div>
  )
}
