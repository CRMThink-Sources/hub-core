import type { ImbotAuth } from '@/app/bitrix/widget/audio/_domain/imbot-context'
import type { WidgetButtonPayload } from '@/app/(widgets)/layouts/button-composer'

export const NEED_OPERATOR_OAUTH = 'NEED_OPERATOR_OAUTH'

export type SendButtonError = Error & {
  code?: string
  status?: number
}

export type SendButtonParams = {
  endpoint: string
  dialogId: string
  domain: string
  imbotAuth?: ImbotAuth | null
  accessToken?: string | null
  body: string
  header: string
  footer: string
  buttons: WidgetButtonPayload[]
}

export async function sendButtonToChat({
  endpoint,
  dialogId,
  domain,
  imbotAuth,
  accessToken,
  body,
  header,
  footer,
  buttons,
}: SendButtonParams): Promise<void> {
  const payload: Record<string, unknown> = {
    dialogId,
    domain,
    body,
    buttons,
  }

  if (header.trim()) payload.header = header
  if (footer.trim()) payload.footer = footer

  if (accessToken) {
    payload.accessToken = accessToken
  } else if (imbotAuth) {
    payload.userId = imbotAuth.userId
    payload.userHash = imbotAuth.userHash
    payload.domainHash = imbotAuth.domainHash
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let code: string | undefined
    try {
      const responseBody = (await response.json()) as {
        code?: string
        result?: { code?: string; error?: string }
      }
      code = responseBody.result?.code ?? responseBody.code
    } catch {
      code = undefined
    }

    const error = new Error(
      `Falha no envio dos botões: ${response.status}`,
    ) as SendButtonError
    error.code = code
    error.status = response.status
    throw error
  }
}
