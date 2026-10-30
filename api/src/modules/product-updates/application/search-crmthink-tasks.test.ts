import { describe, expect, it } from 'vitest'
import { CrmthinkTasksUnavailableError } from '../domain/errors/product-update.errors'
import {
  InMemoryCrmthinkTasksGateway,
  buildCrmthinkTask,
} from '../infra/adapters/in-memory-crmthink-tasks-gateway.fake'
import { SearchCrmthinkTasks } from './search-crmthink-tasks'
import { SearchCrmthinkUsers } from './search-crmthink-users'

const config = { syncEnabled: false, groupId: 2677 }

function makeSut() {
  const gateway = new InMemoryCrmthinkTasksGateway(
    [
      buildCrmthinkTask({ id: 10, title: 'Envio de template' }),
      buildCrmthinkTask({ id: 11, title: 'Template com imagem' }),
      buildCrmthinkTask({ id: 12, title: 'Relatório' }),
      buildCrmthinkTask({
        id: 500,
        title: 'Template do financeiro',
        groupId: 99,
      }),
    ],
    [
      { id: 15, name: 'Maria Souza', email: 'maria@crmthink.com.br' },
      { id: 16, name: 'João Lima', email: 'joao@crmthink.com.br' },
    ],
  )
  return { gateway, useCase: new SearchCrmthinkTasks(gateway, config) }
}

describe('SearchCrmthinkTasks', () => {
  it('ID do projeto configurado: a tarefa, sem aviso', async () => {
    const { useCase } = makeSut()

    const found = await useCase.execute('10')

    expect(found).toEqual([
      expect.objectContaining({ id: 10, outsideGroup: false }),
    ])
  })

  it('ID de outro grupo: aparece marcada como fora do projeto (funciona com sync desligada)', async () => {
    const { useCase, gateway } = makeSut()

    const found = await useCase.execute(' #500 ')

    expect(found).toEqual([
      expect.objectContaining({ id: 500, groupId: 99, outsideGroup: true }),
    ])
    expect(gateway.count('searchTasks')).toBe(0)
  })

  it('ID inexistente: lista vazia', async () => {
    const { useCase } = makeSut()

    expect(await useCase.execute('7777')).toEqual([])
  })

  it('texto: busca por título só no grupo configurado, mais recentes primeiro', async () => {
    const { useCase, gateway } = makeSut()

    const found = await useCase.execute('template')

    expect(gateway.calls).toEqual([
      { method: 'searchTasks', args: ['template', 2677] },
    ])
    expect(found.map(task => task.id)).toEqual([11, 10])
    expect(found.every(task => !task.outsideGroup)).toBe(true)
  })

  it('termo vazio: nenhuma chamada ao Bitrix', async () => {
    const { useCase, gateway } = makeSut()

    expect(await useCase.execute('   ')).toEqual([])
    expect(gateway.count()).toBe(0)
  })

  it('Bitrix indisponível: o erro propaga', async () => {
    const { useCase, gateway } = makeSut()
    gateway.failing = true

    await expect(useCase.execute('template')).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
    await expect(useCase.execute('10')).rejects.toBeInstanceOf(
      CrmthinkTasksUnavailableError,
    )
  })
})

describe('SearchCrmthinkUsers', () => {
  it('busca por nome ou e-mail', async () => {
    const { gateway } = makeSut()
    const useCase = new SearchCrmthinkUsers(gateway)

    expect(await useCase.execute('maria')).toEqual([
      { id: 15, name: 'Maria Souza', email: 'maria@crmthink.com.br' },
    ])
    expect(await useCase.execute('joao@')).toEqual([
      expect.objectContaining({ id: 16 }),
    ])
  })

  it('termo curto: lista vazia sem chamar o Bitrix', async () => {
    const { gateway } = makeSut()

    expect(await new SearchCrmthinkUsers(gateway).execute(' m ')).toEqual([])
    expect(gateway.count()).toBe(0)
  })

  it('Bitrix indisponível: o erro propaga', async () => {
    const { gateway } = makeSut()
    gateway.failing = true

    await expect(
      new SearchCrmthinkUsers(gateway).execute('maria'),
    ).rejects.toBeInstanceOf(CrmthinkTasksUnavailableError)
  })
})
