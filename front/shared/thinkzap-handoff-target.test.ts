import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HANDOFF_DISTRIBUTION_HINT,
  HANDOFF_DISTRIBUTION_LABEL,
  HANDOFF_DISTRIBUTIONS,
  HANDOFF_TARGET_TYPES,
  type HandoffDistribution,
  type HandoffTarget,
  targetDistribution,
  targetUserIds,
  withDistribution,
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
      SCHEMA.indexOf('const handoffTargetSchema'),
      SCHEMA.indexOf('function migrateUserTarget'),
    )
    const doServidor = [...bloco.matchAll(/z\.literal\('(\w+)'\)/g)].map(
      match => match[1],
    )

    expect(doServidor.length).toBeGreaterThan(0)
    expect([...doServidor].sort()).toEqual([...HANDOFF_TARGET_TYPES].sort())
  })

  it('cada variante carrega o id que o servidor exige', () => {
    // Falha de compilação se uma variante perder seu campo obrigatório.
    const alvos: HandoffTarget[] = [
      { type: 'queue' },
      { type: 'line', lineId: '7' },
      { type: 'evenly', bitrixUserIds: ['1'] },
      { type: 'all', bitrixUserIds: ['1', '2'] },
    ]
    expect(alvos.map(alvo => alvo.type)).toEqual(HANDOFF_TARGET_TYPES)
  })
})

describe('distribuição no seletor', () => {
  it('toda opção tem rótulo e explicação', () => {
    for (const opcao of HANDOFF_DISTRIBUTIONS) {
      expect(HANDOFF_DISTRIBUTION_LABEL[opcao]).toBeTruthy()
      expect(HANDOFF_DISTRIBUTION_HINT[opcao]).toBeTruthy()
    }
    expect(HANDOFF_DISTRIBUTIONS).toHaveLength(
      Object.keys(HANDOFF_DISTRIBUTION_LABEL).length,
    )
  })

  it('canal atual e outro canal são a mesma opção do seletor', () => {
    expect(targetDistribution({ type: 'queue' })).toBe('channel')
    expect(targetDistribution({ type: 'line', lineId: '7' })).toBe('channel')
  })

  it('a lista sobrevive entre uniformemente e para todos', () => {
    const antes: HandoffTarget = { type: 'evenly', bitrixUserIds: ['1', '2'] }

    expect(withDistribution('all', antes)).toEqual({
      type: 'all',
      bitrixUserIds: ['1', '2'],
    })
  })

  // `bitrixUserIds` num alvo de canal é recusado pelo zod do servidor no `PATCH`.
  it('trocar para canal descarta a lista', () => {
    const antes: HandoffTarget = { type: 'evenly', bitrixUserIds: ['1'] }

    expect(withDistribution('channel', antes)).toEqual({ type: 'queue' })
    expect(targetUserIds({ type: 'queue' })).toEqual([])
  })

  it('voltar para canal preserva o canal já escolhido', () => {
    const antes: HandoffTarget = { type: 'line', lineId: '7' }

    expect(withDistribution('channel', antes)).toEqual(antes)
  })
})

/** `satisfies` recusa em compilação um tipo que não esteja na união. */
const _exaustivo = HANDOFF_DISTRIBUTION_LABEL satisfies Record<
  HandoffDistribution,
  string
>
void _exaustivo
