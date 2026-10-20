import {
  resolveThinkzapClient,
  thinkzapApiErrorMessage,
} from '@/app/(thinkzap)/thinkzap/_lib/thinkzap-client'

/** Corpo do upload: o arquivo vai no campo `image`, o que a API lê. */
export function buildWidgetHeaderImageFormData(image: Blob): FormData {
  const form = new FormData()
  form.append('image', image)
  return form
}

/**
 * Sobe a imagem do cabeçalho escolhida no widget e devolve a URL pública que o
 * envio manda em `headerImageUrl`. Falha vira `Error` com a mensagem do servidor
 * (arquivo inválido, upload indisponível), que o widget mostra como está.
 */
export async function uploadWidgetHeaderImage(image: File): Promise<string> {
  const client = resolveThinkzapClient()
  if (!client.ok) throw new Error(client.message)

  try {
    const { url } = await client.client.post<{ url: string }>(
      '/thinkzap/messages/widget-template-header-image',
      buildWidgetHeaderImageFormData(image),
    )
    return url
  } catch (error) {
    throw new Error(
      thinkzapApiErrorMessage(
        error,
        'Não foi possível enviar a imagem. Tente de novo ou use um link.',
      ),
    )
  }
}
