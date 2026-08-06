import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpsertCredential } from './upsert-credential'

const input = {
  appId: 'app-1',
  clientId: 'client-1',
  clientSecret: 'secret-1',
  accessToken: 'access-novo',
  refreshToken: 'refresh-novo',
  expiresAt: new Date('2026-07-30T12:00:00.000Z'),
}

function makeRepository() {
  return {
    get: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 'cred-1' }),
    update: vi.fn().mockResolvedValue({ id: 'cred-1' }),
  }
}

describe('UpsertCredential', () => {
  let repository: ReturnType<typeof makeRepository>

  beforeEach(() => {
    repository = makeRepository()
  })

  it('cria a credencial quando o app ainda não tem uma', async () => {
    repository.get.mockResolvedValue(null)

    await new UpsertCredential(repository as never).execute(input)

    expect(repository.create).toHaveBeenCalledWith(input)
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('sobrescreve os tokens quando a credencial já existe', async () => {
    repository.get.mockResolvedValue({ id: 'cred-1', appId: 'app-1' })

    await new UpsertCredential(repository as never).execute(input)

    expect(repository.update).toHaveBeenCalledWith(input)
    expect(repository.create).not.toHaveBeenCalled()
  })
})
