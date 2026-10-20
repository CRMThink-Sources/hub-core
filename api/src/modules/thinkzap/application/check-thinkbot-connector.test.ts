import { describe, expect, it, vi } from 'vitest'
import type { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { AplicationNotFoundError } from '@/modules/application/domain/errors/aplication-not-found.error'
import {
  CheckThinkbotConnector,
  hasActiveConnector,
} from './check-thinkbot-connector'

const NOW = new Date('2026-10-19T12:00:00Z')
const FUTURO = new Date('2026-10-30T23:59:59Z')
const PASSADO = new Date('2026-10-01T23:59:59Z')

const linha = { status: 'active' as const }
const removida = { status: 'cancelled' as const }

describe('hasActiveConnector', () => {
  it('assinatura ativa com linha libera', () => {
    expect(
      hasActiveConnector(
        [{ status: 'active', currentPeriodEnd: PASSADO, items: [linha] }],
        NOW,
      ),
    ).toBe(true)
  })

  it('trial dentro do prazo libera', () => {
    expect(
      hasActiveConnector(
        [{ status: 'trialing', currentPeriodEnd: FUTURO, items: [linha] }],
        NOW,
      ),
    ).toBe(true)
  })

  it.each([
    ['trial vencido', 'trialing', PASSADO],
    ['trial encerrado', 'trial_expired', FUTURO],
    ['cancelada', 'cancelled', FUTURO],
    ['pagamento pendente', 'past_due', FUTURO],
  ] as const)('%s bloqueia', (_, status, currentPeriodEnd) => {
    expect(
      hasActiveConnector([{ status, currentPeriodEnd, items: [linha] }], NOW),
    ).toBe(false)
  })

  it('assinatura ativa só com linhas removidas bloqueia', () => {
    expect(
      hasActiveConnector(
        [{ status: 'active', currentPeriodEnd: FUTURO, items: [removida] }],
        NOW,
      ),
    ).toBe(false)
  })

  it('basta uma assinatura habilitada na instalação', () => {
    expect(
      hasActiveConnector(
        [
          { status: 'cancelled', currentPeriodEnd: FUTURO, items: [linha] },
          { status: 'active', currentPeriodEnd: FUTURO, items: [linha] },
        ],
        NOW,
      ),
    ).toBe(true)
  })

  it('sem assinatura bloqueia', () => {
    expect(hasActiveConnector([], NOW)).toBe(false)
  })
})

describe('CheckThinkbotConnector', () => {
  it('instalação sem espelho no CRM conta como sem conector', async () => {
    const context = {
      execute: vi.fn().mockRejectedValue(new AplicationNotFoundError('x')),
    } as unknown as GetAplicationContext

    await expect(
      new CheckThinkbotConnector(context).execute(
        { domainId: 'd', appCode: 'a' },
        NOW,
      ),
    ).resolves.toBe(false)
  })

  it('falha de leitura do CRM propaga', async () => {
    const context = {
      execute: vi.fn().mockRejectedValue(new Error('timeout')),
    } as unknown as GetAplicationContext

    await expect(
      new CheckThinkbotConnector(context).execute(
        { domainId: 'd', appCode: 'a' },
        NOW,
      ),
    ).rejects.toThrow('timeout')
  })
})
