'use client'

import { useMemo } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  BITRIX_EULA_URL,
  BITRIX_MARKET_TERMS_URL,
  BITRIX_PRIVACY_POLICY_URL,
} from '../../../bitrix/constants'

const LINK_CLASS =
  'font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700'

export interface TermItem {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: React.ReactNode
}

interface TermsAgreementProps {
  terms: TermItem[]
  title?: string
}

export function TermsAgreement({ terms, title }: TermsAgreementProps) {
  const { t } = useTranslation('bitrix/install')

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-700">
        {title ?? t('terms.title')}
      </p>
      <div className="space-y-3 rounded-xl bg-slate-50/80 p-4">
        {terms.map(({ id, checked, onCheckedChange, label }) => (
          <label
            key={id}
            className="flex cursor-pointer gap-3 rounded-lg p-2 transition hover:bg-white/80"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={e => onCheckedChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

const BITRIX_TERMS = [
  {
    id: 'market-terms',
    key: 'terms.marketTerms',
    href: BITRIX_MARKET_TERMS_URL,
  },
  { id: 'eula', key: 'terms.eula', href: BITRIX_EULA_URL },
  { id: 'privacy', key: 'terms.privacy', href: BITRIX_PRIVACY_POLICY_URL },
] as const

export function useBitrixTermsAgreement() {
  const { t } = useTranslation('bitrix/install')

  return useMemo(
    () =>
      BITRIX_TERMS.map(({ id, key, href }) => ({
        id,
        label: (
          <Trans
            t={t}
            i18nKey={key}
            components={{
              link: (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                />
              ),
            }}
          />
        ),
      })),
    [t],
  )
}
