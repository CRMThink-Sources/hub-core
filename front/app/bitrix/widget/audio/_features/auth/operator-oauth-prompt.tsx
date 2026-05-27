'use client'

import { buildThinkzapAuthorizeUrl } from '../../_domain/imbot-context'

type OperatorOAuthPromptProps = {
  domain: string
  appCode: string
}

export function OperatorOAuthPrompt({
  domain,
  appCode,
}: OperatorOAuthPromptProps) {
  const authorizeUrl = buildThinkzapAuthorizeUrl(domain, appCode)

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <p className="text-sm font-medium">
        Autorize o ThinkZap uma vez para enviar audio como voce.
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Abra o app ThinkZap no menu do Bitrix24. Apos o login, volte ao chat e
        grave novamente.
      </p>
      <a
        href={authorizeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
      >
        Autorizar ThinkZap
      </a>
    </div>
  )
}
