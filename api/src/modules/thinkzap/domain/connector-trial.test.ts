import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  TRIAL_DURATION_DAYS,
  checkTrialEligibility,
  isTrialStatus,
  resolveLineEntitlement,
  trialWindow,
} from './connector-trial'
import type { Subscription } from '@/modules/application/domain/entities/subscription'

const NOW = new Date('2026-08-03T12:00:00.000Z')

const sub = (
  status: Subscription['status'],
  currentPeriodEnd: Date,
): Pick<Subscription, 'status' | 'currentPeriodEnd'> => ({
  status,
  currentPeriodEnd,
})

const plusDays = (from: Date, days: number) =>
  new Date(from.getTime() + days * 24 * 60 * 60 * 1000)

describe('trialWindow', () => {
  it('abre no agora e fecha em 3 dias', () => {
    const window = trialWindow(NOW)

    expect(window.currentPeriodStart).toEqual(NOW)
    expect(window.currentPeriodEnd).toEqual(
      new Date('2026-08-06T12:00:00.000Z'),
    )
  })

  it('a duração é a constante, não um literal solto', () => {
    const window = trialWindow(NOW)
    const days =
      (window.currentPeriodEnd.getTime() -
        window.currentPeriodStart.getTime()) /
      (24 * 60 * 60 * 1000)

    expect(days).toBe(TRIAL_DURATION_DAYS)
  })
})

describe('resolveLineEntitlement', () => {
  it('assinatura ativa está habilitada, independente da janela', () => {
    expect(resolveLineEntitlement(sub('active', plusDays(NOW, -30)), NOW)).toBe(
      'active',
    )
  })

  it('trial dentro da janela está habilitado', () => {
    expect(resolveLineEntitlement(sub('trialing', plusDays(NOW, 1)), NOW)).toBe(
      'active',
    )
  })

  it('trial fora da janela está expirado', () => {
    expect(
      resolveLineEntitlement(sub('trialing', plusDays(NOW, -1)), NOW),
    ).toBe('trial-expired')
  })

  /**
   * O último instante da janela ainda vale. Cortar em `currentPeriodEnd` exato
   * tiraria um tick do cliente sem motivo.
   */
  it('o limite exato da janela ainda vale', () => {
    expect(resolveLineEntitlement(sub('trialing', NOW), NOW)).toBe('active')
  })

  it('um milissegundo depois do limite expira', () => {
    const end = new Date(NOW.getTime() - 1)

    expect(resolveLineEntitlement(sub('trialing', end), NOW)).toBe(
      'trial-expired',
    )
  })

  /**
   * `trial-expired` é separado de `inactive` porque a tela trata os dois de forma
   * diferente — trial vencido explica o que fazer, cancelamento é outro assunto.
   */
  it('cancelada e vencida são inativas, não trial expirado', () => {
    expect(
      resolveLineEntitlement(sub('cancelled', plusDays(NOW, 1)), NOW),
    ).toBe('inactive')
    expect(resolveLineEntitlement(sub('past_due', plusDays(NOW, 1)), NOW)).toBe(
      'inactive',
    )
  })

  /** Sem janela nem status não há o que autorize a linha. */
  it('assinatura ausente é inativa', () => {
    expect(resolveLineEntitlement(null, NOW)).toBe('inactive')
  })

  it('teste encerrado por marcação está expirado', () => {
    expect(
      resolveLineEntitlement(sub('trial_expired', plusDays(NOW, -1)), NOW),
    ).toBe('trial-expired')
  })

  /**
   * A marcação vence a janela aberta: ler `currentPeriodEnd` aqui faria um
   * encerramento com período no futuro reabrir a linha.
   */
  it('marcação de encerramento vence a janela no futuro', () => {
    expect(
      resolveLineEntitlement(sub('trial_expired', plusDays(NOW, 30)), NOW),
    ).toBe('trial-expired')
  })

  /** É `trial-expired` e não `inactive`: a tela diz coisas diferentes nos dois. */
  it('teste marcado não é confundido com assinatura inativa', () => {
    expect(
      resolveLineEntitlement(sub('trial_expired', plusDays(NOW, 1)), NOW),
    ).not.toBe('inactive')
  })

  /**
   * A modalidade diz **como** a assinatura é cobrada, não **se** ela vale. Sem
   * isso, boleto criado à mão na SPA não destravaria a linha, e a modalidade
   * manual — que existe justamente para fechar contrato fora do self-service —
   * precisaria de código de cobrança para funcionar.
   */
  describe('modalidade não participa da decisão', () => {
    const withModality = (
      modality: Subscription['modality'],
      status: Subscription['status'],
    ) =>
      ({
        status,
        currentPeriodEnd: plusDays(NOW, 1),
        modality,
      }) as Pick<Subscription, 'status' | 'currentPeriodEnd'>

    it.each<[Subscription['status'], string]>([
      ['active', 'active'],
      ['past_due', 'inactive'],
      ['cancelled', 'inactive'],
    ])('resolve %s igual nas duas modalidades', (status, expected) => {
      expect(resolveLineEntitlement(withModality('manual', status), NOW)).toBe(
        expected,
      )
      expect(resolveLineEntitlement(withModality('stripe', status), NOW)).toBe(
        expected,
      )
    })

    /**
     * `active` não depende da janela — ela só governa trial. Boleto `active` com
     * período vencido continua habilitado, e é o que a spec de modalidade manual
     * afirma.
     */
    it('manual active com período no passado continua habilitada', () => {
      expect(
        resolveLineEntitlement(
          {
            status: 'active',
            currentPeriodEnd: plusDays(NOW, -30),
          },
          NOW,
        ),
      ).toBe('active')
    })
  })
})

/**
 * O predicado existe para não haver `status === 'trialing'` espalhado. Este teste
 * cobre os cinco status de uma vez, o que é o ponto: um status novo tem um lugar
 * só para ser classificado.
 */
describe('isTrialStatus', () => {
  it.each<[Subscription['status'], boolean]>([
    ['trialing', true],
    ['trial_expired', true],
    ['active', false],
    ['past_due', false],
    ['cancelled', false],
  ])('%s é de teste: %s', (status, expected) => {
    expect(isTrialStatus(status)).toBe(expected)
  })
})

describe('checkTrialEligibility', () => {
  const aplication = (spaId: string | null) => ({ spaId }) as never

  const context = (
    spaId: string | null,
    statuses: Subscription['status'][],
  ) => ({
    aplication: aplication(spaId),
    subscriptions: statuses.map(status => ({ status })) as never,
  })

  it('instalação sem assinatura é elegível', () => {
    expect(checkTrialEligibility(context('1060-1', []))).toEqual({
      eligible: true,
    })
  })

  /**
   * O critério é ausência de assinatura, não ausência de `trialing`: o trial
   * expirado continua existindo, e é isso que torna "nunca ativou" verificável.
   */
  it('trial já usado não é elegível, com razão própria', () => {
    expect(checkTrialEligibility(context('1060-1', ['trialing']))).toEqual({
      eligible: false,
      reason: 'already-used',
    })
  })

  it('cliente pagante não é elegível, com razão de contrato', () => {
    expect(checkTrialEligibility(context('1060-1', ['active']))).toEqual({
      eligible: false,
      reason: 'has-contract',
    })
  })

  it('assinatura vencida conta como contrato, não como trial usado', () => {
    expect(checkTrialEligibility(context('1060-1', ['past_due']))).toEqual({
      eligible: false,
      reason: 'has-contract',
    })
  })

  it('trial mais contrato reporta contrato', () => {
    expect(
      checkTrialEligibility(context('1060-1', ['trialing', 'active'])),
    ).toEqual({ eligible: false, reason: 'has-contract' })
  })

  /**
   * Sem o predicado isto reportaria `has-contract`, e a tela diria "você já é
   * cliente" para quem só fez um teste.
   */
  it('só teste marcado como expirado reporta que já usou', () => {
    expect(checkTrialEligibility(context('1060-1', ['trial_expired']))).toEqual(
      {
        eligible: false,
        reason: 'already-used',
      },
    )
  })

  it('teste marcado mais contrato reporta contrato', () => {
    expect(
      checkTrialEligibility(context('1060-1', ['trial_expired', 'active'])),
    ).toEqual({ eligible: false, reason: 'has-contract' })
  })

  it('os dois status de teste juntos reportam que já usou', () => {
    expect(
      checkTrialEligibility(context('1060-1', ['trialing', 'trial_expired'])),
    ).toEqual({ eligible: false, reason: 'already-used' })
  })

  /**
   * Sem `spaId` a listagem de assinaturas nem roda — o filtro depende dele. Então
   * `subscriptions: []` aqui significaria "elegível" por ausência de dado que não
   * foi consultado, e é por isso que a checagem vem primeiro.
   */
  it('instalação sem espelho na SPA não é elegível, e a razão diz isso', () => {
    expect(checkTrialEligibility(context(null, []))).toEqual({
      eligible: false,
      reason: 'no-spa-mirror',
    })
  })
})

/**
 * Estas funções são chamadas de dentro do caminho quente de mensagem. Um import de
 * infra aqui arrastaria Prisma, Redis ou o cliente do Bitrix para dentro de uma
 * decisão que tem que ser aritmética — e o custo apareceria por mensagem recebida,
 * não num teste.
 *
 * Verificado sobre o texto do módulo: o único import é `import type`, apagado na
 * compilação. Um `import` de valor de qualquer coisa reprova.
 */
describe('connector-trial (estrutura)', () => {
  const source = readFileSync(join(__dirname, 'connector-trial.ts'), 'utf8')
  // Só as linhas de import: o corpo menciona Prisma e Redis em comentário, de
  // propósito, explicando justamente por que eles não estão aqui.
  const imports = source.match(/^import .*$/gm) ?? []

  it('não importa infra', () => {
    expect(imports.length).toBeGreaterThan(0)
    for (const line of imports) {
      expect(line).not.toMatch(/prisma|redis|ioredis|bitrix\.client|\.client'/i)
    }
  })

  it('só tem imports de tipo', () => {
    for (const line of imports) {
      expect(line).toMatch(/^import type /)
    }
  })

  /**
   * A forma mais forte de "nenhum caminho de entitlement consulta modalidade":
   * o módulo que decide não menciona o campo. O comentário da entidade afirma
   * isso; aqui a afirmação passa a ser verificável.
   */
  it('não menciona modalidade', () => {
    expect(source).not.toMatch(/modality/i)
  })
})
