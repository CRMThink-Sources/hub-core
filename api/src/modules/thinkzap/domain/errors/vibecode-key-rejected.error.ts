import type { KeyRejection } from '@/modules/thinkzap/domain/vibecode-key-policy'

const MOTIVOS: Record<KeyRejection['code'], string> = {
  WRONG_TYPE: 'a chave não é do tipo pessoal',
  WRONG_PORTAL: 'a chave pertence a outro portal Bitrix24',
  MISSING_SCOPES: 'faltam escopos',
  EXTRA_SCOPES: 'há escopos além do necessário',
  NOT_READONLY: 'a chave não é somente leitura (READONLY)',
}

function descrever(r: KeyRejection): string {
  const base = MOTIVOS[r.code]
  return r.scopes && r.scopes.length > 0
    ? `${base}: ${r.scopes.join(', ')}`
    : base
}

/**
 * A chave Vibecode informada não atende à política do Insights. Os escopos de
 * uma chave Bitrix não podem ser alterados depois de emitida, então a única
 * correção possível é gerar uma chave nova; por isso a mensagem lista cada
 * motivo (para o cliente corrigir tudo de uma vez) e diz o que emitir.
 */
export class VibecodeKeyRejectedError extends Error {
  constructor(readonly reasons: KeyRejection[]) {
    super(
      `Chave Vibecode recusada: ${reasons.map(descrever).join('; ')}. ` +
        'Emita uma nova chave READONLY com exatamente os 5 escopos ' +
        '(crm, imopenlines, im, user, department), pois os escopos não ' +
        'podem ser alterados depois que a chave é emitida.',
    )
    this.name = 'VibecodeKeyRejectedError'
  }
}
