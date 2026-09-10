import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  describeContactIdentity,
  resolveZApiContactIdentity,
} from './resolve-zapi-contact-identity'

const INSTANCE = 'instance-db-1'
const LID = '3577724534928@lid'
const PHONE_RAW = '554792259475'
const PHONE = '5547992259475'

function deps({
  byLid = null,
  byPhone = null,
  phoneExistsResult = null,
  useLidIdentity = true,
}: {
  byLid?: unknown
  byPhone?: unknown
  phoneExistsResult?: unknown
  useLidIdentity?: boolean
} = {}) {
  const identityRepo = {
    findByLid: vi.fn().mockResolvedValue(byLid),
    findByPhone: vi.fn().mockResolvedValue(byPhone),
    upsertPair: vi.fn().mockResolvedValue(undefined),
  }
  const phoneExists = vi.fn().mockResolvedValue(phoneExistsResult)

  return { identityRepo, phoneExists, useLidIdentity }
}

function event(overrides: Record<string, unknown> = {}) {
  return { phone: PHONE_RAW, chatLid: LID, ...overrides } as {
    phone: string
    chatLid?: string | null
    senderLid?: string | null
  }
}

describe('resolveZApiContactIdentity — a cadeia', () => {
  let d: ReturnType<typeof deps>

  beforeEach(() => {
    d = deps()
  })

  /**
   * O caso comum: os dois campos vêm, e o LID ganha. É a linha que impede as duas
   * formas do mesmo contato de virarem dois contatos.
   */
  it('telefone e chatLid: usa o chatLid', async () => {
    const r = await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(r.identity).toBe(LID)
    expect(r.source).toBe('chatLid')
    expect(r.phone).toBe(PHONE)
  })

  it('phone lid e chatLid: mesma identidade do caso anterior', async () => {
    const r = await resolveZApiContactIdentity(
      event({ phone: LID }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(LID)
    // O contato não tem telefone conhecido por este evento.
    expect(r.phone).toBeNull()
  })

  it('phone lid e chatLid nulo: extrai o lid do phone', async () => {
    const r = await resolveZApiContactIdentity(
      event({ phone: LID, chatLid: null }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(LID)
    expect(r.source).toBe('phone')
  })

  /**
   * O buraco da regra ingênua. `chatLid` nulo só coincide com `phone` numérico — é
   * exatamente o ramo que "phone sem @lid → usa chatLid" mandaria para `null`.
   */
  it('phone numérico e chatLid nulo: cai no senderLid', async () => {
    const r = await resolveZApiContactIdentity(
      event({ chatLid: null, senderLid: LID }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(LID)
    expect(r.source).toBe('senderLid')
  })

  it('sem lid no payload: o mapa resolve, sem ir ao provider', async () => {
    d = deps({
      byPhone: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: null,
      },
    })

    const r = await resolveZApiContactIdentity(
      event({ chatLid: null, senderLid: null }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(LID)
    expect(r.source).toBe('map')
    expect(d.phoneExists).not.toHaveBeenCalled()
  })

  it('sem lid e sem mapa: consulta o provider', async () => {
    d = deps({
      phoneExistsResult: { exists: true, phone: PHONE, lid: LID },
    })

    const r = await resolveZApiContactIdentity(
      event({ chatLid: null, senderLid: null }),
      INSTANCE,
      d,
    )

    expect(d.phoneExists).toHaveBeenCalledWith(PHONE)
    expect(r.identity).toBe(LID)
    expect(r.source).toBe('provider')
  })

  /**
   * Não lança: a mensagem do contato é real, e chegar com identidade imperfeita é
   * melhor que não chegar. Quem registra o risco é o chamador, pela `source`.
   */
  it('cadeia esgotada: cai no telefone e marca a origem', async () => {
    d = deps({ phoneExistsResult: null })

    const r = await resolveZApiContactIdentity(
      event({ chatLid: null, senderLid: null }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(PHONE)
    expect(r.lid).toBeNull()
    expect(r.source).toBe('none')
  })

  it('provider responde exists:false: também é cadeia esgotada', async () => {
    d = deps({ phoneExistsResult: { exists: false, phone: PHONE, lid: null } })

    const r = await resolveZApiContactIdentity(
      event({ chatLid: null, senderLid: null }),
      INSTANCE,
      d,
    )

    expect(r.source).toBe('none')
    expect(r.identity).toBe(PHONE)
  })

  /**
   * O `@lid` nunca pode virar telefone: o strip de não-dígitos devolveria os dígitos do
   * lid, e o Bitrix os gravaria como telefone do contato.
   */
  it('nunca deriva telefone de um valor @lid', async () => {
    const r = await resolveZApiContactIdentity(
      event({ phone: LID }),
      INSTANCE,
      d,
    )

    expect(r.phone).toBeNull()
    expect(r.phone).not.toBe('3577724534928')
  })
})

describe('resolveZApiContactIdentity — aprendizado do mapa', () => {
  it('grava o par quando não havia row', async () => {
    const d = deps()

    await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(d.identityRepo.upsertPair).toHaveBeenCalledWith({
      instanceId: INSTANCE,
      lid: LID,
      phone: PHONE,
    })
  })

  it('grava o telefone quando a row existia sem ele', async () => {
    const d = deps({
      byLid: {
        instanceId: INSTANCE,
        lid: LID,
        phone: null,
        legacyPhoneIdentity: null,
      },
    })

    await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(d.identityRepo.upsertPair).toHaveBeenCalledWith({
      instanceId: INSTANCE,
      lid: LID,
      phone: PHONE,
    })
  })

  it('não escreve quando não há nada novo a aprender', async () => {
    const d = deps({
      byLid: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: null,
      },
    })

    await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(d.identityRepo.upsertPair).not.toHaveBeenCalled()
  })

  /** O ganho do mapa: a chamada de rede é uma por contato, não uma por mensagem. */
  it('contato já mapeado não consulta o provider', async () => {
    const d = deps({
      byPhone: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: null,
      },
    })

    await resolveZApiContactIdentity(
      event({ chatLid: null, senderLid: null }),
      INSTANCE,
      d,
    )

    expect(d.phoneExists).not.toHaveBeenCalled()
    expect(d.identityRepo.upsertPair).not.toHaveBeenCalled()
  })
})

describe('resolveZApiContactIdentity — identidade legada', () => {
  it('row com identidade legada mantém o telefone como chat.id', async () => {
    const d = deps({
      byLid: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: PHONE,
      },
    })

    const r = await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(r.identity).toBe(PHONE)
    expect(r.legacy).toBe(true)
  })

  /**
   * O caso que o desenho sem mapa não cobriria: contato legado que volta a escrever
   * lid-only. O mapa é bidirecional, então ele é reencontrado.
   */
  it('contato legado que chega lid-only é reencontrado pelo mapa', async () => {
    const d = deps({
      byLid: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: PHONE,
      },
    })

    const r = await resolveZApiContactIdentity(
      event({ phone: LID, chatLid: LID }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(PHONE)
    expect(r.legacy).toBe(true)
  })

  it('row sem identidade legada usa o lid', async () => {
    const d = deps({
      byLid: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: null,
      },
    })

    const r = await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(r.identity).toBe(LID)
    expect(r.legacy).toBe(false)
  })
})

describe('resolveZApiContactIdentity — flag de rollout', () => {
  it('desligada: identidade é a de hoje', async () => {
    const d = deps({ useLidIdentity: false })

    const r = await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(r.identity).toBe(PHONE)
  })

  it('desligada com phone lid e sem telefone mapeado: identidade é o valor cru, como hoje', async () => {
    const d = deps({ useLidIdentity: false })

    const r = await resolveZApiContactIdentity(
      event({ phone: LID }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(LID)
  })

  /**
   * O caso real que quebrava: contato já escreveu antes com `chatLid` (mensagem
   * normal), o mapa aprendeu o telefone dele. Chega um evento cujo `phone` já é o lid
   * (visualização única, que a Z-API entrega sem `chatLid`) — sem este fallback, essa
   * mensagem ganhava uma identidade diferente (o lid cru) da que as mensagens normais
   * do mesmo contato usam (o telefone), abrindo uma segunda conversa no canal aberto
   * pra mesma pessoa.
   */
  it('desligada com phone lid e telefone já mapeado: usa o telefone mapeado, não o lid', async () => {
    const d = deps({
      useLidIdentity: false,
      byLid: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: null,
      },
    })

    const r = await resolveZApiContactIdentity(
      event({ phone: LID, chatLid: null }),
      INSTANCE,
      d,
    )

    expect(r.identity).toBe(PHONE)
  })

  /** É isto que permite o deploy anteceder o backfill. */
  it('desligada: o mapa continua aprendendo', async () => {
    const d = deps({ useLidIdentity: false })

    await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(d.identityRepo.upsertPair).toHaveBeenCalledWith({
      instanceId: INSTANCE,
      lid: LID,
      phone: PHONE,
    })
  })

  it('ligada: identidade é o lid', async () => {
    const d = deps({ useLidIdentity: true })

    const r = await resolveZApiContactIdentity(event(), INSTANCE, d)

    expect(r.identity).toBe(LID)
  })
})

describe('describeContactIdentity', () => {
  it('nomeia a origem e o legado', async () => {
    const d = deps({
      byLid: {
        instanceId: INSTANCE,
        lid: LID,
        phone: PHONE,
        legacyPhoneIdentity: PHONE,
      },
    })
    const r = await resolveZApiContactIdentity(event(), INSTANCE, d)

    const line = describeContactIdentity(r)
    expect(line).toContain('origem=chatLid')
    expect(line).toContain('LEGADO')
  })

  it('cadeia esgotada avisa que o contato volta a poder duplicar', async () => {
    const d = deps({ phoneExistsResult: null })
    const r = await resolveZApiContactIdentity(
      event({ chatLid: null, senderLid: null }),
      INSTANCE,
      d,
    )

    expect(describeContactIdentity(r)).toContain('SEM LID')
    expect(describeContactIdentity(r)).toContain('duplicado')
  })
})
