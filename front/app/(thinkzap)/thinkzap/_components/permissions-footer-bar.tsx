'use client'

import { Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type Props = {
  dirtyCount: number
  saving: boolean
  onSave: () => void
}

export function PermissionsFooterBar({ dirtyCount, saving, onSave }: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
        <Button
          type="button"
          disabled={dirtyCount === 0 || saving}
          onClick={onSave}
          className="w-full lg:w-auto lg:min-w-[180px]"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {t('saveChanges')}
        </Button>
      </div>
    </div>
  )
}
