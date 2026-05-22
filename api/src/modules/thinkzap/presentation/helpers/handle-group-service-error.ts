import { httpResponse } from '@/shared/helpers/http'

export function mapGroupServiceError(
  error: unknown,
  fallbackMessage: string,
): httpResponse {
  const message = error instanceof Error ? error.message : fallbackMessage

  if (message === 'Connector not found' || message === 'Instance not found') {
    return { status: 404, result: { error: message } }
  }

  return { status: 400, result: { error: message } }
}
