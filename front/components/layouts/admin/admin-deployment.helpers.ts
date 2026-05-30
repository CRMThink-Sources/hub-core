export function resolveRegisterMessage(
  result: string,
  t: (key: string) => string,
  keyPrefix: string,
): string {
  if (result === 'created') return t(`${keyPrefix}ResultCreated`)
  if (result === 'updated') return t(`${keyPrefix}ResultUpdated`)
  return t(`${keyPrefix}ResultSkipped`)
}

export function resolveDeleteMessage(
  result: string,
  t: (key: string) => string,
  keyPrefix: string,
): string {
  if (result === 'not_found') return t(`${keyPrefix}ResultNotFound`)
  return t(`${keyPrefix}ResultDeleted`)
}

export function resolveDeploymentApiError(
  err: unknown,
  t: (key: string) => string,
  keyPrefix: string,
): string {
  const apiError = (
    err as { response?: { data?: { result?: { error?: string } } } }
  )?.response?.data?.result?.error

  if (typeof apiError === 'string') {
    if (apiError.toLowerCase().includes('not installed')) {
      return t(`${keyPrefix}ErrorNotInstalled`)
    }
    if (apiError.toLowerCase().includes('credential')) {
      return t(`${keyPrefix}ErrorCredential`)
    }
  }

  return t(`${keyPrefix}ErrorGeneric`)
}

export function resolveListApiError(
  err: unknown,
  t: (key: string) => string,
  keyPrefix: string,
): string {
  const data = (
    err as {
      response?: { data?: { error?: string; result?: { error?: string } } }
    }
  )?.response?.data

  const apiError =
    (typeof data?.result?.error === 'string' ? data.result.error : undefined) ??
    (typeof data?.error === 'string' ? data.error : undefined)

  if (typeof apiError === 'string') {
    const lower = apiError.toLowerCase()
    if (lower.includes('not installed')) {
      return t(`${keyPrefix}ErrorNotInstalled`)
    }
    if (lower.includes('credential')) {
      return t(`${keyPrefix}ErrorCredential`)
    }
    if (
      lower.includes('tls') ||
      lower.includes('certificate') ||
      lower.includes('bitrix_tls_reject_unauthorized')
    ) {
      return t(`${keyPrefix}ErrorTls`)
    }
  }

  return t(`${keyPrefix}ErrorGeneric`)
}
