import { describe, expect, it } from 'vitest'
import {
  buildActivityCard,
  buildCancelActivityCard,
  CardSigner,
} from './build-activity-card'

const signers: CardSigner[] = [
  { signerKey: 'sk1', name: 'Ana', email: 'ana@x.com' },
  { signerKey: 'sk2', name: 'Beto', email: 'beto@x.com' },
]

const base = {
  dealId: 42,
  documentId: 'doc-key',
  envelopeKey: 'env-key',
  groupId: 'Grupo 1',
  signers,
  apiToken: 'tok',
}

function originIdOf(card: Record<string, unknown>): Record<string, unknown> {
  const fields = card.fields as { originId: string }
  return JSON.parse(fields.originId) as Record<string, unknown>
}

describe('buildActivityCard', () => {
  it('monta o originId com group, envelopeKey e [signerKey]:false por signer (D2)', () => {
    const origin = originIdOf(buildActivityCard(base))
    expect(origin).toEqual({
      group: 'Grupo 1',
      envelopeKey: 'env-key',
      sk1: false,
      sk2: false,
    })
  })

  it('grava SUBJECT = documentId (match do webhook por %SUBJECT)', () => {
    const fields = buildActivityCard(base).fields as { SUBJECT: string }
    expect(fields.SUBJECT).toBe('doc-key')
  })

  it('inclui o botão cancelar com os actionParams', () => {
    const card = buildActivityCard(base)
    const layout = card.layout as {
      footer: {
        buttons: {
          cancelButton?: {
            action: { id: string; actionParams: Record<string, unknown> }
          }
        }
      }
    }
    const btn = layout.footer.buttons.cancelButton
    expect(btn?.action.id).toBe('cancelDocument')
    expect(btn?.action.actionParams).toMatchObject({
      documentKey: 'doc-key',
      dealId: 42,
      apiToken: 'tok',
    })
  })

  it('injeta o activityId no body e no botão quando presente', () => {
    const card = buildActivityCard({ ...base, activityId: 99 })
    expect(card.id).toBe(99)
    const layout = card.layout as {
      footer: { buttons: { cancelButton: { action: { actionParams: { activityId?: number } } } } }
    }
    expect(layout.footer.buttons.cancelButton.action.actionParams.activityId).toBe(
      99,
    )
  })

  it('omite o id do body sem activityId', () => {
    expect(buildActivityCard(base).id).toBeUndefined()
  })
})

describe('buildCancelActivityCard', () => {
  it('marca header Cancelado (failure) e preserva o originId', () => {
    const card = buildCancelActivityCard({
      activityId: 7,
      dealId: 42,
      documentKey: 'doc-key',
      originId: '{"group":"g"}',
      logoUri: 'https://x',
    })
    const layout = card.layout as {
      header: { tags: { status: { type: string; title: string } } }
    }
    expect(layout.header.tags.status).toEqual({
      type: 'failure',
      title: 'Cancelado',
    })
    const fields = card.fields as { originId: string }
    expect(fields.originId).toBe('{"group":"g"}')
  })
})
