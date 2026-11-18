import { VibecodeKeyRejectedError } from '@/modules/thinkzap/domain/errors/vibecode-key-rejected.error'
import type { InsightsSettingsRepository } from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { evaluateVibecodeMe } from '@/modules/thinkzap/domain/vibecode-key-policy'
import type { VibecodeClient } from '@/modules/thinkzap/infra/clients/vibecode.client'
import { encryptToken } from '@/shared/infra/crypto/token-cipher'
import { clearKeyProblem } from './key-health'

type Deps = {
  settings: InsightsSettingsRepository
  makeClient: (key: string) => Pick<VibecodeClient, 'me'>
  getPortalDomain: (appId: string) => Promise<string>
  now?: () => Date
}

/**
 * A chave costuma ser colada de e-mail/planilha: vem com espaços, quebra de
 * linha e às vezes entre aspas. Limpar aqui evita recusar uma chave boa.
 */
function cleanKey(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
}

/**
 * Valida a chave na Vibecode (`me`) contra a política do Insights e só então
 * a guarda cifrada. Erros do `me` sobem como estão: o cliente não inclui a
 * chave nas mensagens, e este caso de uso também nunca a coloca em texto.
 */
export class SaveVibecodeKey {
  private readonly now: () => Date

  constructor(private readonly deps: Deps) {
    this.now = deps.now ?? (() => new Date())
  }

  async execute(appId: string, rawKey: string): Promise<{ last4: string }> {
    const key = cleanKey(rawKey)
    if (!key) throw new Error('Informe a chave Vibecode.')

    const me = await this.deps.makeClient(key).me()
    const domain = await this.deps.getPortalDomain(appId)
    const verdict = evaluateVibecodeMe(me, domain)
    if (!verdict.ok) throw new VibecodeKeyRejectedError(verdict.reasons)

    const last4 = key.slice(-4)
    await this.deps.settings.saveKey(appId, {
      keyEnc: encryptToken(key),
      last4,
      portalId: me.portalId ?? null,
      validatedAt: this.now(),
    })
    clearKeyProblem(appId)
    return { last4 }
  }
}
