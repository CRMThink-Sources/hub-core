import { describe, expect, it, vi } from 'vitest'
import type { BotFlowGraph } from '@/modules/thinkzap/domain/bot-flow/flow'
import type { ParsedBotEvent } from '@/modules/thinkzap/domain/bot-flow/bot-event'
import type { BotFlow } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow.repository'
import type { BotFlowBinding } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-flow-binding.repository'
import type { BotSession } from '@/modules/thinkzap/domain/repositories/bot-flow/bot-session.repository'
import { BotSessionGoneError } from '@/modules/thinkzap/domain/bot-flow/session-gone'
import { runBotTurn, type RunBotTurnDeps } from './run-bot-turn'

const APP = 'app-1'
const LINE = '224'
const CHAT = '5'

// `validate: 'email'` de propósito: dá um caminho válido e um inválido, que é o que
// separa "avança" de "retry" nos testes abaixo.
const graph: BotFlowGraph = {
  entryNodeId: 'ask',
  settings: { escapeKeywords: [], escapeNext: null },
  nodes: [
    {
      id: 'ask',
      kind: 'input',
      text: 'Qual seu e-mail?',
      saveAs: 'email',
      validate: 'email',
      maxAttempts: 2,
      retryText: 'Não entendi, repete?',
      onExhausted: 'entrega',
      next: 'entrega',
    },
    {
      id: 'entrega',
      kind: 'handoff',
      target: { type: 'queue' },
    },
  ],
} as unknown as BotFlowGraph

const flow: BotFlow = {
  id: 'flow-1',
  appId: APP,
  name: 'Comercial',
  status: 'PUBLISHED',
  version: 3,
  graph,
  publishedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
}

const binding: BotFlowBinding = {
  id: 'bind-1',
  appId: APP,
  flowId: 'flow-1',
  lineId: LINE,
  priority: 100,
  active: true,
  condition: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function evento(over: Partial<ParsedBotEvent> = {}): ParsedBotEvent {
  return {
    kind: 'message',
    chatId: CHAT,
    botCode: 'thinkzap-flow',
    bitrixBotId: 2060,
    domain: 'p.bitrix24.com',
    text: 'oi',
    authorId: '31',
    ...over,
  }
}

// Spies retornados à parte: `expect(port.say)` destacaria o método do objeto e o lint
// (`unbound-method`) recusa.
function makeDeps(
  over: {
    sessaoAtiva?: BotSession | null
    flowAtual?: BotFlow | null
    bindingAtual?: BotFlowBinding | null
  } = {},
) {
  // Args declarados: sem eles o TS infere `calls` como tupla vazia e `calls[0][1]` não existe.
  const say = vi.fn((_chatId: string, _text: string) => Promise.resolve())
  const handoff = vi.fn((_chatId: string, _target: unknown) =>
    Promise.resolve(),
  )
  const finish = vi.fn((_chatId: string) => Promise.resolve())
  const create = vi.fn((input: { currentNodeId: string }) =>
    Promise.resolve({ id: 'sess-1', ...input } as unknown as BotSession),
  )
  const advanceSession = vi.fn(() => Promise.resolve())
  const close = vi.fn(() => Promise.resolve())

  const deps: RunBotTurnDeps = {
    session: { say, handoff, finish },
    sessions: {
      getActiveByChatId: () => Promise.resolve(over.sessaoAtiva ?? null),
      create,
      advance: advanceSession,
      close,
    },
    flows: {
      getById: () =>
        Promise.resolve(over.flowAtual === undefined ? flow : over.flowAtual),
    },
    bindings: {
      getByLineId: () =>
        Promise.resolve(
          over.bindingAtual === undefined ? binding : over.bindingAtual,
        ),
    },
    now: () => new Date('2026-08-31T12:00:00Z'),
  }

  return { deps, say, handoff, finish, create, advanceSession, close }
}

describe('runBotTurn', () => {
  it('join começa o fluxo, fala e cria a sessão', async () => {
    const { deps, say, create } = makeDeps()

    const out = await runBotTurn(
      evento({ kind: 'join', text: '' }),
      LINE,
      APP,
      deps,
    )

    expect(out.kind).toBe('ran')
    expect(say).toHaveBeenCalledWith(CHAT, 'Qual seu e-mail?')
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      bitrixChatId: CHAT,
      currentNodeId: 'ask',
      flowVersion: 3,
      bindingId: 'bind-1',
    })
  })

  describe('bot fora da sessão', () => {
    const gone = () =>
      new BotSessionGoneError(
        'imopenlines.bot.session.message.send',
        'CANCELED',
        CHAT,
      )

    it('encerra a sessão nova como EXPIRED em vez de propagar', async () => {
      // Propagar geraria retry de uma chamada que nunca passa, e a sessão ficaria `ACTIVE`
      // prendendo o chat até o TTL.
      const { deps, say, close } = makeDeps()
      say.mockRejectedValue(gone())

      const out = await runBotTurn(
        evento({ kind: 'join', text: '' }),
        LINE,
        APP,
        deps,
      )

      expect(out).toEqual({ kind: 'gone', code: 'CANCELED' })
      expect(close).toHaveBeenCalledWith('sess-1', 'EXPIRED')
    })

    it('encerra a sessão que já existia', async () => {
      const { deps, say, close } = makeDeps({
        sessaoAtiva: {
          id: 'sess-viva',
          currentNodeId: 'ask',
          vars: {},
          attempts: 0,
          graph,
          flowId: 'flow-1',
          flowVersion: 3,
          bindingId: 'bind-1',
        } as unknown as BotSession,
      })
      say.mockRejectedValue(gone())

      const out = await runBotTurn(
        evento({ text: 'nao-e-email' }),
        LINE,
        APP,
        deps,
      )

      expect(out.kind).toBe('gone')
      expect(close).toHaveBeenCalledWith('sess-viva', 'EXPIRED')
    })

    it('falha comum continua subindo para retry', async () => {
      // A distinção é o tipo do erro: só `BotSessionGoneError` encerra.
      const { deps, say, close } = makeDeps()
      say.mockRejectedValue(new Error('ECONNRESET'))

      await expect(
        runBotTurn(evento({ kind: 'join', text: '' }), LINE, APP, deps),
      ).rejects.toThrow('ECONNRESET')
      expect(close).not.toHaveBeenCalled()
    })

    it('não tenta transferir para a fila', async () => {
      // O bot não fala mais no chat: transferir falharia pelo mesmo motivo.
      const { deps, say, handoff } = makeDeps()
      say.mockRejectedValue(gone())

      await runBotTurn(evento({ kind: 'join', text: '' }), LINE, APP, deps)

      expect(handoff).not.toHaveBeenCalled()
    })
  })

  it('grava o estado antes de falar', async () => {
    // Fala antes de gravar: se a gravação caísse, a resposta do cliente seria lida como
    // resposta da pergunta anterior.
    const ordem: string[] = []
    const { deps, say, create } = makeDeps()
    say.mockImplementation(() => {
      ordem.push('say')
      return Promise.resolve()
    })
    create.mockImplementation(() => {
      ordem.push('create')
      return Promise.resolve({ id: 'sess-1' } as unknown as BotSession)
    })

    await runBotTurn(evento({ kind: 'join', text: '' }), LINE, APP, deps)

    expect(ordem).toEqual(['create', 'say'])
  })

  it('resposta do cliente avança a sessão existente', async () => {
    const sessao: BotSession = {
      id: 'sess-1',
      appId: APP,
      bitrixChatId: CHAT,
      flowId: 'flow-1',
      flowVersion: 3,
      graph,
      bindingId: 'bind-1',
      currentNodeId: 'ask',
      vars: {},
      attempts: 0,
      status: 'ACTIVE',
    }
    const { deps, handoff, close } = makeDeps({ sessaoAtiva: sessao })

    await runBotTurn(
      evento({ text: 'gustavo@crmthink.com.br' }),
      LINE,
      APP,
      deps,
    )

    // Resposta válida vai para `entrega`, que é terminal: fecha em vez de avançar.
    expect(handoff).toHaveBeenCalledWith(CHAT, { type: 'queue' })
    expect(close).toHaveBeenCalledWith('sess-1', 'HANDED_OFF')
  })

  it('sessão viva roda o snapshot, não o fluxo republicado', async () => {
    // Republicar no meio do atendimento mudaria as opções sob os pés de quem já
    // respondeu: o `graph` da sessão é a fonte, o do repositório não é lido.
    const outroGraph = {
      ...graph,
      nodes: [{ ...graph.nodes[0], text: 'PERGUNTA NOVA' }, graph.nodes[1]],
    } as unknown as BotFlowGraph

    const sessao: BotSession = {
      id: 'sess-1',
      appId: APP,
      bitrixChatId: CHAT,
      flowId: 'flow-1',
      flowVersion: 3,
      graph,
      bindingId: 'bind-1',
      currentNodeId: 'ask',
      vars: {},
      attempts: 0,
      status: 'ACTIVE',
    }

    const { deps, say } = makeDeps({
      sessaoAtiva: sessao,
      flowAtual: { ...flow, version: 4, graph: outroGraph },
    })

    // Resposta inválida força o retry: o único caminho que devolve o texto do nó atual
    // sem sair dele, e por isso o que distingue snapshot de fluxo republicado.
    await runBotTurn(evento({ text: 'x' }), LINE, APP, deps)

    const falas = say.mock.calls.map(c => String(c[1])).join(' ')
    expect(falas).toContain('Não entendi')
    expect(falas).not.toContain('PERGUNTA NOVA')
  })

  it('sem vínculo não fala nada e reporta o motivo', async () => {
    const { deps, say, handoff } = makeDeps({ bindingAtual: null })

    const out = await runBotTurn(evento(), LINE, APP, deps)

    expect(out).toEqual({ kind: 'skipped', reason: 'sem-vinculo' })
    expect(say).not.toHaveBeenCalled()
    expect(handoff).not.toHaveBeenCalled()
  })

  it('vínculo inativo não roda', async () => {
    const { deps } = makeDeps({ bindingAtual: { ...binding, active: false } })

    const out = await runBotTurn(evento(), LINE, APP, deps)

    expect(out).toEqual({ kind: 'skipped', reason: 'vinculo-inativo' })
  })

  it('fluxo despublicado não roda', async () => {
    const { deps } = makeDeps({ flowAtual: { ...flow, status: 'DRAFT' } })

    const out = await runBotTurn(evento(), LINE, APP, deps)

    expect(out).toEqual({ kind: 'skipped', reason: 'fluxo-nao-publicado' })
  })

  it('não cria sessão quando o fluxo termina no primeiro passo', async () => {
    // Row `ACTIVE` sem próximo nó bloquearia o chat até expirar.
    const soHandoff = {
      entryNodeId: 'entrega',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [{ id: 'entrega', kind: 'handoff', target: { type: 'queue' } }],
    } as unknown as BotFlowGraph

    const { deps, create, handoff } = makeDeps({
      flowAtual: { ...flow, graph: soHandoff },
    })

    await runBotTurn(evento({ kind: 'join', text: '' }), LINE, APP, deps)

    expect(create).not.toHaveBeenCalled()
    expect(handoff).toHaveBeenCalledWith(CHAT, { type: 'queue' })
  })

  it('alvo de handoff inexecutável cai na fila', async () => {
    // A publicação valida o grafo, mas o operador pode ter sido apagado no Bitrix
    // depois: transferir para id vazio deixaria o chat órfão.
    const alvoVazio = {
      entryNodeId: 'entrega',
      settings: { escapeKeywords: [], escapeNext: null },
      nodes: [
        {
          id: 'entrega',
          kind: 'handoff',
          target: { type: 'user', bitrixUserId: '' },
        },
      ],
    } as unknown as BotFlowGraph

    const { deps, handoff } = makeDeps({
      flowAtual: { ...flow, graph: alvoVazio },
    })

    await runBotTurn(evento({ kind: 'join', text: '' }), LINE, APP, deps)

    expect(handoff).toHaveBeenCalledWith(CHAT, { type: 'queue' })
  })
})
