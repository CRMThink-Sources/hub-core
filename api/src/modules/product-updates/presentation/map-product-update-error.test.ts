import { describe, expect, it } from 'vitest'
import {
  BitrixUserNotLinkedError,
  CrmthinkTaskNotFoundError,
  CrmthinkTaskResponsibleRequiredError,
  CrmthinkTasksUnavailableError,
  InvalidProductUpdateContentError,
  InvalidProductUpdateImageError,
  InvalidTaskMessageError,
  ProductUpdateActionRefusedError,
  ProductUpdateImageStorageUnavailableError,
  ProductUpdateIncompleteError,
  ProductUpdateNotFoundError,
  TaskAlreadyLinkedError,
  TasksSyncDisabledError,
} from '../domain/errors/product-update.errors'
import { mapProductUpdateError } from './map-product-update-error'

describe('mapProductUpdateError', () => {
  it('não encontrada: 404 só com a mensagem', () => {
    expect(mapProductUpdateError(new ProductUpdateNotFoundError())).toEqual({
      status: 404,
      result: { error: 'Novidade não encontrada' },
    })
  })

  it('ação recusada: 409 com o motivo', () => {
    const error = new ProductUpdateActionRefusedError('published-before')
    expect(mapProductUpdateError(error)).toEqual({
      status: 409,
      result: { error: error.message, reason: 'published-before' },
    })
  })

  it('tarefa já vinculada: 409 com a tarefa e a novidade dona', () => {
    const error = new TaskAlreadyLinkedError(42, 'pu-9')
    expect(mapProductUpdateError(error)).toEqual({
      status: 409,
      result: {
        error: error.message,
        reason: 'task-already-linked',
        taskId: 42,
        productUpdateId: 'pu-9',
      },
    })
  })

  it('sincronização desligada: 409 tasks-sync-disabled', () => {
    const error = new TasksSyncDisabledError()
    expect(mapProductUpdateError(error)).toEqual({
      status: 409,
      result: { error: error.message, reason: 'tasks-sync-disabled' },
    })
  })

  it('idiomas incompletos: 422 missing-locales com os idiomas', () => {
    const error = new ProductUpdateIncompleteError(['en', 'es'])
    expect(mapProductUpdateError(error)).toEqual({
      status: 422,
      result: {
        error: error.message,
        reason: 'missing-locales',
        missingLocales: ['en', 'es'],
      },
    })
  })

  it('conteúdo inválido: 422 invalid-content com os problemas', () => {
    const error = new InvalidProductUpdateContentError(['pt.title: longo'])
    expect(mapProductUpdateError(error)).toEqual({
      status: 422,
      result: {
        error: error.message,
        reason: 'invalid-content',
        issues: ['pt.title: longo'],
      },
    })
  })

  it('imagem inválida: 422 invalid-image', () => {
    const error = new InvalidProductUpdateImageError('A imagem passa de 5 MB')
    expect(mapProductUpdateError(error)).toEqual({
      status: 422,
      result: { error: 'A imagem passa de 5 MB', reason: 'invalid-image' },
    })
  })

  it('tarefa inexistente: 422 task-not-found com o id', () => {
    const error = new CrmthinkTaskNotFoundError(77)
    expect(mapProductUpdateError(error)).toEqual({
      status: 422,
      result: { error: error.message, reason: 'task-not-found', taskId: 77 },
    })
  })

  it('sem responsável: 422 responsible-required', () => {
    const error = new CrmthinkTaskResponsibleRequiredError()
    expect(mapProductUpdateError(error)).toEqual({
      status: 422,
      result: { error: error.message, reason: 'responsible-required' },
    })
  })

  it('Bitrix fora: 502 crmthink-tasks-unavailable', () => {
    const error = new CrmthinkTasksUnavailableError('ACCESS_DENIED')
    expect(mapProductUpdateError(error)).toEqual({
      status: 502,
      result: {
        error: 'Bitrix da CRMThink indisponível: ACCESS_DENIED',
        reason: 'crmthink-tasks-unavailable',
      },
    })
  })

  it('sem tarefa vinculada: 409 no-task-linked', () => {
    const error = new ProductUpdateActionRefusedError('no-task-linked')
    expect(mapProductUpdateError(error)).toEqual({
      status: 409,
      result: { error: error.message, reason: 'no-task-linked' },
    })
  })

  it('mensagem inválida: 422 invalid-message', () => {
    const error = new InvalidTaskMessageError()
    expect(mapProductUpdateError(error)).toEqual({
      status: 422,
      result: { error: error.message, reason: 'invalid-message' },
    })
  })

  it('usuário sem vínculo com o Bitrix: 422 bitrix-user-not-linked', () => {
    const error = new BitrixUserNotLinkedError()
    expect(mapProductUpdateError(error)).toEqual({
      status: 422,
      result: { error: error.message, reason: 'bitrix-user-not-linked' },
    })
  })

  it('R2 indisponível: 503 image-storage-unavailable', () => {
    const error = new ProductUpdateImageStorageUnavailableError()
    expect(mapProductUpdateError(error)).toEqual({
      status: 503,
      result: { error: error.message, reason: 'image-storage-unavailable' },
    })
  })

  it('erro de fora da família: undefined', () => {
    expect(mapProductUpdateError(new Error('x'))).toBeUndefined()
  })
})
