import axios from 'axios'
import { GoogleAuthRequiredError } from '../domain/errors/google-auth-required.error'
import { GoogleConnectionService } from './google-connection.service'

function isUnauthorized(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401
}

function isAuthFailure(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    return status === 400 || status === 401
  }
  return (
    error instanceof Error && error.message.includes('connection not found')
  )
}

async function getToken(
  connection: GoogleConnectionService,
  appId: string,
  force: boolean,
): Promise<string> {
  try {
    return await connection.getAccessToken(appId, force)
  } catch (error) {
    if (isAuthFailure(error)) throw new GoogleAuthRequiredError()
    throw error
  }
}

/**
 * Executa uma chamada à API do Google com o access token do app, renovando e
 * tentando 1x quando o token está revogado/expirado fora do buffer (401).
 * Falha de auth definitiva → GoogleAuthRequiredError.
 */
export async function runWithGoogleTokenRetry<T>(
  connection: GoogleConnectionService,
  appId: string,
  run: (accessToken: string) => Promise<T>,
): Promise<T> {
  const accessToken = await getToken(connection, appId, false)
  try {
    return await run(accessToken)
  } catch (error) {
    if (!isUnauthorized(error)) throw error
    const fresh = await getToken(connection, appId, true)
    try {
      return await run(fresh)
    } catch (retryError) {
      if (isUnauthorized(retryError)) throw new GoogleAuthRequiredError()
      throw retryError
    }
  }
}
