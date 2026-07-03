'use client'

import { Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { THINKZAP_PERMISSION_ACTIONS } from '@/shared/thinkzap-permissions'

const LEGEND_COLORS: Record<
  (typeof THINKZAP_PERMISSION_ACTIONS)[number],
  string
> = {
  read: 'bg-blue-600 text-white',
  create: 'bg-sky-400 text-white',
  update: 'bg-violet-500 text-white',
  delete: 'bg-pink-500 text-white',
}

type Props = {
  dirtyCount: number
  saving: boolean
  onSave: () => void
}

export function PermissionsFooterBar({ dirtyCount, saving, onSave }: Props) {
  const { t } = useTranslation('thinkzap/permissoes')

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-border bg-card/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* <span className="text-xs font-medium text-slate-600">
              {t('legendTitle')}:
            </span> */}
            {/* {THINKZAP_PERMISSION_ACTIONS.map(action => (
              <span
                key={action}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${LEGEND_COLORS[action]}`}
              >
                {t(`matrix.actionsShort.${action}`)}
                <span className="font-normal opacity-90">
                  {t(`legend.${action}`)}
                </span>
              </span>
            ))} */}
          </div>
        </div>

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
