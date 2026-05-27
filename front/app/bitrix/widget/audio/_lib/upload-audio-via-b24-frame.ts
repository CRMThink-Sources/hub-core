import type { B24FrameClient } from '@/bitrix/b24-jssdk.types'

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Falha ao converter audio'))
        return
      }

      const base64 = reader.result.split(',')[1]
      if (!base64) {
        reject(new Error('Falha ao converter audio'))
        return
      }

      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Falha ao converter audio'))
    reader.readAsDataURL(blob)
  })
}

export async function uploadAudioViaB24Frame(
  client: B24FrameClient,
  params: {
    dialogId: string
    blob: Blob
    fileName: string
  },
): Promise<void> {
  const content = await blobToBase64(params.blob)
  const response = await client.callMethod('im.v2.File.upload', {
    dialogId: params.dialogId,
    fields: {
      name: params.fileName,
      content,
      message: '',
    },
  })

  const data = response.getData()
  if (data.error || data.error_description) {
    throw new Error(data.error_description ?? data.error ?? 'Falha no upload')
  }
}
