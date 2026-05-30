import type { ImbotAuth } from '../../_domain/imbot-context'

export const NEED_OPERATOR_OAUTH = 'NEED_OPERATOR_OAUTH'

export type UploadAudioError = Error & {
  code?: string
  status?: number
}

export type UploadAudioParams = {
  endpoint: string
  audioBlob: Blob
  dialogId: string
  domain: string
  imbotAuth?: ImbotAuth | null
  accessToken?: string | null
}

export async function uploadAudioToChat({
  endpoint,
  audioBlob,
  dialogId,
  domain,
  imbotAuth,
  accessToken,
}: UploadAudioParams): Promise<void> {
  const formData = new FormData()
  formData.append('audio', audioBlob, `audio-${Date.now()}.mp3`)
  formData.append('dialogId', dialogId)
  formData.append('domain', domain)

  if (accessToken) {
    formData.append('accessToken', accessToken)
  } else if (imbotAuth) {
    formData.append('userId', imbotAuth.userId)
    formData.append('userHash', imbotAuth.userHash)
    formData.append('domainHash', imbotAuth.domainHash)
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    let code: string | undefined
    try {
      const body = (await response.json()) as {
        code?: string
        result?: { code?: string; error?: string }
      }
      code = body.result?.code ?? body.code
    } catch {
      code = undefined
    }

    const error = new Error(
      `Falha no upload do audio: ${response.status}`,
    ) as UploadAudioError
    error.code = code
    error.status = response.status
    throw error
  }
}
