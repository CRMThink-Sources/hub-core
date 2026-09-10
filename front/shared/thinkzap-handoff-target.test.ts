import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HANDOFF_TARGET_LABEL,
  HANDOFF_TARGET_TYPES,
  type HandoffTarget,
  type HandoffTargetType,
} from './thinkzap-bot-flow'

/**
 * Este arquivo é espelho de `api/.../bot-flow/flow.ts`, e nada verificava isso: a API
 * já aceitava `{ type: 'line' }` enquanto o tipo do front conhecia dois alvos. O zod é
 * mais permissivo que o tipo, então o fluxo gravava e só quebrava na tela.
 *
 * Lê o schema do servidor como texto porque os dois lados são pacotes separados —
 * importar de lá não compila aqui.
 */
const SCHEMA = readFileSync(
  join(
    __dirname,
    '../../api/src/modules/thinkzap/domain/bot-flow/flow.schema.ts',
  ),
  'utf-8',
)

describe('HandoffTarget espelha o servidor', () => {
  it('todo alvo aceito pelo zod existe no tipo do front', () => {
    const bloco = SCHEMA.slice(
      SCHEMA.indexOf('const handoffNodeSchema'),
      SCHEMA.indexOf('const finishNodeSchema'),
    )
    const doServidor = [...bloco.matchAll(/z\.literal\('(\w+)'\)/g)]
      .map(match => match[1])
      .filter(nome => nome !== 'handoff')

    expect(doServidor.length).toBeGreaterThan(0)
    expect([...doServidor].sort()).toEqual([...HANDOFF_TARGET_TYPES].sort())
  })

  it('todo alvo tem rótulo no seletor', () => {
    for (const tipo of HANDOFF_TARGET_TYPES) {
      expect(HANDOFF_TARGET_LABEL[tipo]).toBeTruthy()
    }
    expect(HANDOFF_TARGET_TYPES).toHaveLength(
      Object.keys(HANDOFF_TARGET_LABEL).length,
    )
  })

  it('cada variante carrega o id que o servidor exige', () => {
    // Falha de compilação se uma variante perder seu campo obrigatório.
    const alvos: HandoffTarget[] = [
      { type: 'queue' },
      { type: 'user', bitrixUserId: '1' },
      { type: 'line', lineId: '7' },
    ]
    expect(alvos.map(alvo => alvo.type)).toEqual(HANDOFF_TARGET_TYPES)
  })
})

/** `satisfies` recusa em compilação um tipo que não esteja na união. */
const _exaustivo = HANDOFF_TARGET_LABEL satisfies Record<
  HandoffTargetType,
  string
>
void _exaustivo
