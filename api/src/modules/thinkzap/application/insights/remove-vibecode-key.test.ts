import { describe, expect, it, vi } from 'vitest'
import type { InsightsSettingsRepository } from '@/modules/thinkzap/domain/repositories/insights-settings/insights-settings.repository'
import { RemoveVibecodeKey } from './remove-vibecode-key'
import { getKeyProblem, markKeyRevoked } from './key-health'

describe('RemoveVibecodeKey', () => {
  it('remove limpa a chave e o problema registrado', async () => {
    const removeKey = vi.fn<InsightsSettingsRepository['removeKey']>(
      async () => {},
    )
    const useCase = new RemoveVibecodeKey({
      settings: { removeKey } as unknown as InsightsSettingsRepository,
    })
    await markKeyRevoked('app-1')

    await useCase.execute('app-1')

    expect(removeKey).toHaveBeenCalledWith('app-1')
    expect(await getKeyProblem('app-1')).toBeNull()
  })
})
