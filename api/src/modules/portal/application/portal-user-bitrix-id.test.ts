import { describe, expect, it } from 'vitest'
import type { PortalUser } from '../domain/entities/portal-user'
import type {
  CreatePortalUserInput,
  ListPortalUsersInput,
  ListPortalUsersRepositoryResult,
  PortalUserRepository,
} from '../domain/repositories/portal-user.repository'
import { PortalUserNotFoundError } from '../domain/errors/portal-auth.errors'
import { CreatePortalUser } from './create-portal-user'
import { ListPortalUsers } from './list-portal-users'
import { UpdatePortalUserBitrixId } from './update-portal-user-bitrix-id'

class InMemoryPortalUserRepository implements PortalUserRepository {
  readonly users: PortalUser[] = []

  findByEmail(email: string) {
    return Promise.resolve(this.users.find(u => u.email === email) ?? null)
  }

  findById(id: string) {
    return Promise.resolve(this.users.find(u => u.id === id) ?? null)
  }

  create(input: CreatePortalUserInput) {
    const user: PortalUser = {
      id: `user-${this.users.length + 1}`,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role,
      isActive: input.isActive,
      bitrixUserId: input.bitrixUserId ?? null,
      createdAt: new Date('2026-10-29T12:00:00.000Z'),
      updatedAt: new Date('2026-10-29T12:00:00.000Z'),
    }
    this.users.push(user)
    return Promise.resolve(user)
  }

  updateBitrixUserId(id: string, bitrixUserId: number | null) {
    const user = this.users.find(u => u.id === id)
    if (!user) return Promise.resolve(null)
    user.bitrixUserId = bitrixUserId
    return Promise.resolve(user)
  }

  listWithPagination(
    _input: ListPortalUsersInput,
  ): Promise<ListPortalUsersRepositoryResult> {
    return Promise.resolve({ users: this.users, total: this.users.length })
  }
}

const newUser = {
  email: 'maria@crmthink.com.br',
  name: 'Maria',
  password: 'senha-forte-123',
}

describe('CreatePortalUser com ID do Bitrix', () => {
  it('cria o usuário com o ID informado', async () => {
    const repository = new InMemoryPortalUserRepository()

    const result = await new CreatePortalUser(repository).execute({
      ...newUser,
      bitrixUserId: 42,
    })

    expect(result.bitrixUserId).toBe(42)
    expect(repository.users[0]?.bitrixUserId).toBe(42)
  })

  it('sem ID, o usuário fica sem vínculo', async () => {
    const repository = new InMemoryPortalUserRepository()

    const result = await new CreatePortalUser(repository).execute(newUser)

    expect(result.bitrixUserId).toBeNull()
  })
})

describe('ListPortalUsers com ID do Bitrix', () => {
  it('devolve o ID, ou nulo quando não há vínculo', async () => {
    const repository = new InMemoryPortalUserRepository()
    const create = new CreatePortalUser(repository)
    await create.execute({ ...newUser, bitrixUserId: 42 })
    await create.execute({
      ...newUser,
      email: 'joao@crmthink.com.br',
      name: 'João',
    })

    const { users } = await new ListPortalUsers(repository).execute({
      page: 1,
      limit: 10,
    })

    expect(users.map(u => u.bitrixUserId)).toEqual([42, null])
  })
})

describe('UpdatePortalUserBitrixId', () => {
  async function makeSut(bitrixUserId?: number) {
    const repository = new InMemoryPortalUserRepository()
    await new CreatePortalUser(repository).execute({
      ...newUser,
      bitrixUserId,
    })
    return {
      repository,
      useCase: new UpdatePortalUserBitrixId(repository),
    }
  }

  it('define o vínculo sem mexer nos outros dados', async () => {
    const { repository, useCase } = await makeSut()
    const before = { ...repository.users[0]! }

    const result = await useCase.execute({ id: 'user-1', bitrixUserId: 42 })

    expect(result).toEqual({ id: 'user-1', bitrixUserId: 42 })
    expect(repository.users[0]).toEqual({ ...before, bitrixUserId: 42 })
  })

  it('troca o vínculo', async () => {
    const { useCase } = await makeSut(42)

    const result = await useCase.execute({ id: 'user-1', bitrixUserId: 7 })

    expect(result.bitrixUserId).toBe(7)
  })

  it('remove o vínculo com null', async () => {
    const { repository, useCase } = await makeSut(42)

    const result = await useCase.execute({ id: 'user-1', bitrixUserId: null })

    expect(result.bitrixUserId).toBeNull()
    expect(repository.users[0]?.bitrixUserId).toBeNull()
  })

  it('usuário inexistente: PortalUserNotFoundError', async () => {
    const { useCase } = await makeSut()

    await expect(
      useCase.execute({ id: 'nao-existe', bitrixUserId: 42 }),
    ).rejects.toBeInstanceOf(PortalUserNotFoundError)
  })
})
