import { describe, expect, it, vi } from 'vitest'
import { resolveReplyChatRoute } from './resolve-reply-chat-route'
import type { ResolvedContactIdentity } from './resolve-zapi-contact-identity'

const LID = '109788054704155@lid'
const PHONE = '5547984050811'

const lidIdentity = (
  over: Partial<ResolvedContactIdentity> = {},
): ResolvedContactIdentity => ({
  identity: LID,
  lid: LID,
  phone: PHONE,
  source: 'chatLid',
  legacy: false,
  ...over,
})

function setup(
  cited: { chatId: string | null; bitrixChatId: string | null } | null,
  pinResult = true,
) {
  const pinLegacyIdentity = vi.fn().mockResolvedValue(pinResult)
  const findMessage = vi.fn().mockResolvedValue(cited)
  const run = (
    identity: ResolvedContactIdentity,
    referenceMessageId: string | null | undefined = 'BTN-1',
  ) =>
    resolveReplyChatRoute(
      { identity, referenceMessageId, instanceDbId: 'INST-A' },
      { identityRepo: { pinLegacyIdentity }, findMessage },
    )
  return { run, pinLegacyIdentity, findMessage }
}

describe('resolveReplyChatRoute', () => {
  it('caso real: resposta ao botão do widget usa o chat.id do envio e fixa a identidade', async () => {
    const { run, pinLegacyIdentity, findMessage } = setup({
      chatId: PHONE,
      bitrixChatId: '97349',
    })

    const result = await run(lidIdentity())

    expect(findMessage).toHaveBeenCalledWith('INST-A', 'BTN-1')
    expect(result).toMatchObject({
      identity: PHONE,
      legacy: true,
      replyRoute: 'routed',
      pinned: true,
    })
    expect(pinLegacyIdentity).toHaveBeenCalledWith({
      instanceId: 'INST-A',
      lid: LID,
      chatId: PHONE,
    })
  })

  it('mensagem seguinte sem citação não consulta nada (a identidade fixada já vem da cadeia)', async () => {
    const { run, findMessage } = setup(null)
    const identity = lidIdentity({ identity: PHONE, legacy: true })

    await expect(run(identity, null)).resolves.toBe(identity)
    expect(findMessage).not.toHaveBeenCalled()
  })

  it.each([
    ['mensagem desconhecida', null],
    ['sem conversa aberta', { chatId: PHONE, bitrixChatId: null }],
    ['sem chat.id gravado', { chatId: null, bitrixChatId: '97349' }],
  ])('%s mantém a identidade resolvida', async (_name, cited) => {
    const { run, pinLegacyIdentity } = setup(cited)
    const identity = lidIdentity()

    await expect(run(identity)).resolves.toBe(identity)
    expect(pinLegacyIdentity).not.toHaveBeenCalled()
  })

  it('citação de conversa de outro contato não roteia', async () => {
    const { run, pinLegacyIdentity } = setup({
      chatId: '5511999990000',
      bitrixChatId: '1',
    })
    const identity = lidIdentity()

    await expect(run(identity)).resolves.toBe(identity)
    expect(pinLegacyIdentity).not.toHaveBeenCalled()
  })

  it('contato lid-only (sem telefone) não roteia: não há como provar a pertença', async () => {
    const { run } = setup({ chatId: PHONE, bitrixChatId: '97349' })
    const identity = lidIdentity({ phone: null })

    await expect(run(identity)).resolves.toBe(identity)
  })

  it('identidade igual à da conversa não grava fixação', async () => {
    const { run, pinLegacyIdentity } = setup({
      chatId: LID,
      bitrixChatId: '97349',
    })
    const identity = lidIdentity()

    await expect(run(identity)).resolves.toBe(identity)
    expect(pinLegacyIdentity).not.toHaveBeenCalled()
  })

  it('identidade já fixada diferente da conversa citada prevalece', async () => {
    const { run, pinLegacyIdentity } = setup({
      chatId: PHONE,
      bitrixChatId: '97349',
    })

    const result = await run(
      lidIdentity({ identity: '5547000000000', legacy: true }),
    )

    expect(result).toMatchObject({
      identity: '5547000000000',
      replyRoute: 'pin-kept',
    })
    expect(pinLegacyIdentity).not.toHaveBeenCalled()
  })

  it('corrida: fixação já gravada por outra resposta ainda roteia, com pinned=false', async () => {
    const { run } = setup({ chatId: PHONE, bitrixChatId: '97349' }, false)

    await expect(run(lidIdentity())).resolves.toMatchObject({
      identity: PHONE,
      replyRoute: 'routed',
      pinned: false,
    })
  })

  it('sem LID resolvido não roteia', async () => {
    const { run, findMessage } = setup({ chatId: PHONE, bitrixChatId: '1' })
    const identity = lidIdentity({ lid: null, identity: PHONE, source: 'none' })

    await expect(run(identity)).resolves.toBe(identity)
    expect(findMessage).not.toHaveBeenCalled()
  })
})
