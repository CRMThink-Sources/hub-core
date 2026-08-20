import { describe, expect, it, vi } from 'vitest'
import { enrichGroupMetadata } from './enrich-group-metadata'

function makeClient(photoUrl: string | null = null) {
  return {
    getProfilePicture: vi.fn().mockResolvedValue(photoUrl),
  }
}

const base = {
  phone: '5511999999999-group',
  description: 'Descrição',
  owner: '5511888888888',
  subject: 'Time comercial',
  creation: 1700000000,
  invitationLink: null,
  communityId: null,
  adminOnlyMessage: 'false',
  adminOnlySettings: 'true',
  requireAdminApproval: false,
  isGroupAnnouncement: false,
  participants: [],
}

describe('enrichGroupMetadata', () => {
  it('coage os booleanos que a Z-API manda como string', async () => {
    const client = makeClient()

    const result = await enrichGroupMetadata(
      base as never,
      client as never,
      'Z-1',
      'TOKEN',
      'g-1',
    )

    expect(result.adminOnlyMessage).toBe(false)
    expect(result.adminOnlySettings).toBe(true)
  })

  /**
   * A regressão: sem `phone` na resposta, a busca da foto ia com `undefined` na
   * URL e o front quebrava em `label.trim()` ao montar as iniciais do avatar.
   */
  it('usa o groupId pedido quando a resposta não traz phone', async () => {
    const client = makeClient()
    const { phone: _omitted, ...semPhone } = base

    const result = await enrichGroupMetadata(
      semPhone as never,
      client as never,
      'Z-1',
      'TOKEN',
      'g-1',
    )

    expect(result.phone).toBe('g-1')
    expect(client.getProfilePicture).toHaveBeenCalledWith('Z-1', 'TOKEN', 'g-1')
  })

  it('devolve subject e description como string mesmo quando ausentes', async () => {
    const client = makeClient()
    const { subject: _s, description: _d, ...semTexto } = base

    const result = await enrichGroupMetadata(
      semTexto as never,
      client as never,
      'Z-1',
      'TOKEN',
      'g-1',
    )

    expect(result.subject).toBe('')
    expect(result.description).toBe('')
  })

  it('normaliza participantes e descarta os sem telefone', async () => {
    const client = makeClient('https://cdn/pic.jpg')
    const withParticipants = {
      ...base,
      participants: [
        { phone: '5511777777777', isAdmin: 'true', isSuperAdmin: false },
        { phone: '', isAdmin: false, isSuperAdmin: false },
        null,
      ],
    }

    const result = await enrichGroupMetadata(
      withParticipants as never,
      client as never,
      'Z-1',
      'TOKEN',
      'g-1',
    )

    expect(result.participants).toHaveLength(1)
    expect(result.participants[0]).toMatchObject({
      phone: '5511777777777',
      isAdmin: true,
      imgUrl: 'https://cdn/pic.jpg',
    })
  })
})
