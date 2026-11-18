import { describe, expect, it } from 'vitest'
import { analyzeMessages } from './analyze-messages'

const role = (id: string) =>
  id === 'c'
    ? 'client'
    : id === 'o'
      ? 'operator'
      : id === 'b'
        ? 'bot'
        : 'system'

const msg = (id: number, senderId: string, date: string, text?: string) => ({
  id,
  senderId,
  date,
  text,
})

describe('analyzeMessages', () => {
  it('calcula 1ª resposta e tempos de resposta do operador', () => {
    const r = analyzeMessages(
      [
        msg(3, 'o', '2026-01-05T10:01:00Z'),
        msg(1, 'c', '2026-01-05T10:00:00Z'),
        msg(2, 'c', '2026-01-05T10:00:30Z'),
        msg(4, 'c', '2026-01-05T10:05:00Z'),
        msg(5, 'o', '2026-01-05T10:07:00Z'),
      ],
      role,
    )
    expect(r.initiatedBy).toBe('client')
    expect(r.clientCode).toBe('c')
    expect(r.firstClient).toBe('2026-01-05T10:00:00Z')
    expect(r.firstOperator).toBe('2026-01-05T10:01:00Z')
    expect(r.lastOperator).toBe('2026-01-05T10:07:00Z')
    expect(r.replyTimes).toEqual([60, 120])
    expect(r.msgsClient).toBe(3)
    expect(r.msgsOperator).toBe(2)
    expect(r.clientReplied).toBeNull()
  })

  it('conversa só com bot não conta resposta humana', () => {
    const r = analyzeMessages([msg(1, 'b', '2026-01-05T10:00:00Z')], role)
    expect(r.msgsBot).toBe(1)
    expect(r.msgsOperator).toBe(0)
    expect(r.firstOperator).toBeNull()
    expect(r.initiatedBy).toBeNull()
    expect(r.replyTimes).toEqual([])
  })

  it('conversa só do cliente não gera replyTimes', () => {
    const r = analyzeMessages([msg(1, 'c', '2026-01-05T10:00:00Z')], role)
    expect(r.replyTimes).toEqual([])
    expect(r.firstOperator).toBeNull()
    expect(r.msgsClient).toBe(1)
  })

  it('conversa só de sistema não quebra nem conta mensagens humanas', () => {
    const r = analyzeMessages([msg(1, 's', '2026-01-05T10:00:00Z', 'x')], role)
    expect(r.msgsClient + r.msgsOperator + r.msgsBot).toBe(0)
    expect(r.initiatedBy).toBeNull()
    expect(r.clientReplied).toBeNull()
  })

  it('lista vazia devolve zeros', () => {
    const r = analyzeMessages([], role)
    expect(r.replyTimes).toEqual([])
    expect(r.initiatedBy).toBeNull()
  })

  it('clientReplied só existe quando a empresa iniciou', () => {
    const semRetorno = analyzeMessages(
      [msg(1, 'o', '2026-01-05T10:00:00Z')],
      role,
    )
    expect(semRetorno.initiatedBy).toBe('company')
    expect(semRetorno.clientReplied).toBe(false)
    const comRetorno = analyzeMessages(
      [
        msg(1, 'o', '2026-01-05T10:00:00Z'),
        msg(2, 'c', '2026-01-05T10:01:00Z'),
      ],
      role,
    )
    expect(comRetorno.clientReplied).toBe(true)
  })

  it('detecta aceite e redirecionamento pelo texto do sistema', () => {
    const r = analyzeMessages(
      [
        msg(1, 's', '2026-01-05T10:00:00Z', 'Chat redirecionado'),
        msg(2, 's', '2026-01-05T10:01:00Z', 'Ana aceitou a conversa'),
        msg(3, 's', '2026-01-05T10:02:00Z', 'Agent accepted'),
        msg(4, 's', '2026-01-05T10:03:00Z', 'transferido'),
      ],
      role,
    )
    expect(r.acceptedAt).toBe('2026-01-05T10:01:00Z')
    expect(r.redirects).toBe(2)
  })
})
