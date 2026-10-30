import { describe, expect, it } from 'vitest'
import {
  groupTaskMessages,
  productUpdateErrorKey,
  readProductUpdateError,
  TASK_MESSAGE_MAX,
  taskMessageAuthor,
  validateTaskMessage,
  type TaskMessage,
} from './portal-product-updates'

const message = (id: number, createdAt: string, extra?: Partial<TaskMessage>) =>
  ({
    id,
    authorId: 7,
    authorName: 'Ana',
    text: `m${id}`,
    createdAt,
    isSystem: false,
    ...extra,
  }) satisfies TaskMessage

describe('validateTaskMessage', () => {
  it('apara o texto e aceita de 1 a 4000 caracteres', () => {
    expect(validateTaskMessage('  oi \n')).toEqual({ ok: true, text: 'oi' })
    expect(validateTaskMessage('a'.repeat(TASK_MESSAGE_MAX))).toMatchObject({
      ok: true,
    })
  })

  it('recusa vazio e só espaços', () => {
    expect(validateTaskMessage('')).toEqual({ ok: false, reason: 'empty' })
    expect(validateTaskMessage(' \n\t ')).toEqual({
      ok: false,
      reason: 'empty',
    })
  })

  it('recusa acima do limite depois de aparado', () => {
    expect(validateTaskMessage('a'.repeat(TASK_MESSAGE_MAX + 1))).toEqual({
      ok: false,
      reason: 'too-long',
    })
    expect(
      validateTaskMessage(` ${'a'.repeat(TASK_MESSAGE_MAX)} `),
    ).toMatchObject({ ok: true })
  })

  it('mantém as quebras de linha do meio', () => {
    expect(validateTaskMessage('a\n\nb')).toEqual({ ok: true, text: 'a\n\nb' })
  })
})

describe('taskMessageAuthor', () => {
  it('usa o nome, aparado', () => {
    expect(taskMessageAuthor({ authorId: 1, authorName: ' Ana ' })).toEqual({
      kind: 'name',
      name: 'Ana',
    })
  })

  it('cai para o id e depois para nenhum (Sistema)', () => {
    expect(taskMessageAuthor({ authorId: 9, authorName: null })).toEqual({
      kind: 'id',
      id: 9,
    })
    expect(taskMessageAuthor({ authorId: 9, authorName: '  ' })).toEqual({
      kind: 'id',
      id: 9,
    })
    expect(taskMessageAuthor({ authorId: null, authorName: null })).toEqual({
      kind: 'none',
    })
    expect(taskMessageAuthor({ authorId: 0, authorName: null })).toEqual({
      kind: 'none',
    })
  })
})

describe('groupTaskMessages', () => {
  it('agrupa por dia local mantendo a ordem', () => {
    const groups = groupTaskMessages(
      [
        message(1, '2026-03-10T12:00:00'),
        message(2, '2026-03-10T15:30:00'),
        message(3, '2026-03-11T09:00:00'),
      ],
      'pt-BR',
    )
    expect(groups.map(g => g.key)).toEqual(['2026-03-10', '2026-03-11'])
    expect(groups[0].messages.map(m => m.id)).toEqual([1, 2])
    expect(groups[0].messages[0].timeLabel).toMatch(/12:00/)
    expect(groups[0].label).toMatch(/2026/)
  })

  it('preserva texto e quebras de linha, e devolve vazio sem mensagens', () => {
    const [group] = groupTaskMessages(
      [message(1, '2026-03-10T12:00:00', { text: 'a\nb' })],
      'en',
    )
    expect(group.messages[0].text).toBe('a\nb')
    expect(groupTaskMessages([], 'en')).toEqual([])
  })

  it('não quebra com data inválida', () => {
    const [group] = groupTaskMessages([message(1, 'ontem')], 'pt-BR')
    expect(group.label).toBe('ontem')
    expect(group.messages[0].timeLabel).toBe('ontem')
  })
})

describe('erros da conversa da tarefa', () => {
  it.each([
    'no-task-linked',
    'invalid-message',
    'bitrix-user-not-linked',
    'tasks-sync-disabled',
    'task-not-found',
    'crmthink-tasks-unavailable',
  ])('%s tem mensagem própria', reason => {
    const info = readProductUpdateError({
      response: { status: 422, data: { result: { reason } } },
    })
    expect(productUpdateErrorKey(info)).toBe(`errors.${reason}`)
  })
})
