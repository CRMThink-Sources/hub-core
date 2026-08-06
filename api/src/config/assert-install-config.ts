import { env } from './env'

/**
 * Config exigida pelo installer do ThinkZap. Sem ela a instalação abortaria no
 * primeiro cliente que tentasse instalar — e o certo é quebrar no deploy, onde
 * quem pode corrigir está olhando.
 *
 * Só o que torna o app inoperante entra aqui. Placement de áudio e robô são
 * opcionais por design: o installer os pula quando não há handler.
 */
const REQUIRED = [
  ['BITRIX_WEBHOOK_URL (ou API_URL)', () => env.bitrix.webhookUrl],
  ['BITRIX_CONNECTOR_CODE', () => env.bitrix.connector.code],
  ['BITRIX_CONNECTOR_URL', () => env.bitrix.connector.url],
] as const

export function assertInstallConfig(): void {
  const missing = REQUIRED.filter(([, read]) => !read()).map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(
      `Config de instalação ausente: ${missing.join(', ')}. ` +
        'O endpoint de instalação não pode registrar o app no portal sem esses valores.',
    )
  }
}
