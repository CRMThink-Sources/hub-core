/**
 * Mensagem de erro das ações de provedor de mensagem.
 *
 * Compartilhada pela seção do modal de linha e pela aba de provedores porque as duas
 * chamam as mesmas rotas e falham pelos mesmos motivos — e porque o caso que mais
 * importa é o mesmo nas duas: **escopo ausente**.
 *
 * O escopo `messageservice` é publicado no manifesto do app e depende de o portal
 * reautorizar. Sem tradução própria ele cai em "erro ao comunicar com o Bitrix24", e um
 * admin que lê isso vai investigar a linha e a credencial, que estão corretas.
 */
export function resolveSmsProviderApiError(
  err: unknown,
  t: (key: string) => string,
): string {
  const response = (
    err as {
      response?: {
        status?: number
        data?: { error?: string; result?: { error?: string } }
      }
    }
  )?.response

  /** `409` é o código que o mapa de erros da linha reserva para escopo ausente. */
  if (response?.status === 409) return t('smsProviderErrorScope')

  const apiError =
    (typeof response?.data?.result?.error === 'string'
      ? response.data.result.error
      : undefined) ??
    (typeof response?.data?.error === 'string'
      ? response.data.error
      : undefined)

  if (typeof apiError === 'string') {
    const lower = apiError.toLowerCase()

    if (lower.includes('messageservice')) return t('smsProviderErrorScope')
    if (lower.includes('credential')) return t('smsProviderErrorCredential')
    if (lower.includes('not installed'))
      return t('smsProviderErrorNotInstalled')
    if (
      lower.includes('tls') ||
      lower.includes('certificate') ||
      lower.includes('bitrix_tls_reject_unauthorized')
    ) {
      return t('smsSendersErrorTls')
    }
  }

  return t('smsProviderErrorGeneric')
}
