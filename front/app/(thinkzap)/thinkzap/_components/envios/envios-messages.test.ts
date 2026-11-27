import { describe, expect, it } from 'vitest'
import pt from '@/messages/pt/thinkzap/envios.json'
import en from '@/messages/en/thinkzap/envios.json'
import es from '@/messages/es/thinkzap/envios.json'
import { SEND_STATUSES, sendStatusView } from '../../_lib/send-status'

const leafKeys = (node: unknown, prefix = ''): string[] =>
  node && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leafKeys(value, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix]

const valueAt = (messages: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      messages,
    )

/**
 * Mesmo padrão de `lib/insights-messages-parity.test.ts`: chave que falta num
 * idioma aparece crua (o nome da chave) na tela de quem usa aquele idioma.
 */
describe('mensagens da aba Envios', () => {
  it('pt, en e es têm as mesmas chaves', () => {
    const keys = leafKeys(pt).sort()
    expect(leafKeys(en).sort()).toEqual(keys)
    expect(leafKeys(es).sort()).toEqual(keys)
  })

  it('nenhum texto vazio', () => {
    for (const messages of [pt, en, es]) {
      for (const key of leafKeys(messages)) {
        expect(valueAt(messages, key), key).toEqual(expect.any(String))
        expect(String(valueAt(messages, key)).trim(), key).not.toBe('')
      }
    }
  })

  it('todo status da API tem rótulo nos três idiomas', () => {
    for (const status of SEND_STATUSES) {
      const { labelKey } = sendStatusView(status)
      for (const messages of [pt, en, es]) {
        expect(valueAt(messages, labelKey), labelKey).toEqual(
          expect.any(String),
        )
      }
    }
  })

  it('os avisos e o vazio em pt são os textos combinados', () => {
    expect(pt.notices.retention).toBe(
      'O histórico dos envios é guardado por {{retentionDays}} dias.',
    )
    expect(pt.notices.zapi).toBe(
      'Linhas Z-API informam só "Enviado" (sem confirmação de entrega).',
    )
    expect(pt.states.emptyTitle).toBe('Nenhum envio no período')
    expect(pt.detail.notFound).toBe('Envio não encontrado')
    expect(pt.unconfirmedWarning).toBe(
      'Confira a conversa com o contato antes de reenviar.',
    )
    expect(es.title).toBe('Envíos')
    expect(en.title).toBe('Sends')
  })
})
