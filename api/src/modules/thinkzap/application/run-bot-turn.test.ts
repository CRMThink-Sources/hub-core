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

// O `eco` mostra de qual grafo o turno saiu.
const graph: BotFlowGraph = {
  entryNodeId: 'ask',
  settings: { escapeKeywords: [], escapeTarget: null },
  nodes: [
    {
      id: 'ask',
      kind: 'message',
      text: 'Qual seu e-mail?',
      capture: 'email',
      next: 'eco',
    },
    {
      id: 'eco',
      kind: 'message',
      text: 'Anotado.',
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
    authorName: 'Gustavo',
    ...over,
  }
}

// Spies à parte por causa do lint `unbound-method`.
function makeDeps(
  over: {
    sessaoAtiva?: BotSession | null
    flowAtual?: BotFlow | null
    bindingAtual?: BotFlowBinding | null
    /** Quando o chat foi entregue a um atendente, se foi. */
    entregueEm?: Date | null
    connectorAtivo?: boolean
  } = {},
) {
  // Args declarados: sem eles o TS infere `calls` como tupla vazia e `calls[0][1]` não existe.
  const say = vi.fn((_chatId: string, _text: string) => Promise.resolve())
  const handoff = vi.fn((_chatId: string, _target: unknown) =>
    Promise.resolve(),
  )
  const finish = vi.fn((_chatId: string) => Promise.resolve())
  const whisper = vi.fn((_chatId: string, _text: string) => Promise.resolve())
  const create = vi.fn((input: { currentNodeId: string }) =>
    Promise.resolve({ id: 'sess-1', ...input } as unknown as BotSession),
  )
  const advanceSession = vi.fn(() => Promise.resolve())
  const close = vi.fn(() => Promise.resolve())
  const connectorAtivo = vi.fn(() =>
    Promise.resolve(over.connectorAtivo ?? true),
  )

  const deps: RunBotTurnDeps = {
    session: { say, whisper, handoff, finish },
    sessions: {
      getActiveByChatId: () => Promise.resolve(over.sessaoAtiva ?? null),
      handoffAtByChatId: () => Promise.resolve(over.entregueEm ?? null),
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
    connectorAtivo,
    now: () => new Date('2026-08-31T12:00:00Z'),
  }

  return {
    deps,
    say,
    handoff,
    finish,
    create,
    advanceSession,
    close,
    connectorAtivo,
  }
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
      // Propagar: retry eterno e sessão `ACTIVE` presa até o TTL.
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
      // Duas capturas: a sessão segue viva e precisa virar `EXPIRED`.
      const graphDuasCapturas = {
        ...graph,
        nodes: [
          { ...graph.nodes[0], next: 'ask2' },
          {
            id: 'ask2',
            kind: 'message',
            text: 'E o telefone?',
            capture: 'telefone',
            next: 'entrega',
          },
          graph.nodes[2],
        ],
      } as unknown as BotFlowGraph

      const { deps, say, close } = makeDeps({
        sessaoAtiva: {
          id: 'sess-viva',
          currentNodeId: 'ask',
          vars: {},
          attempts: 0,
          graph: graphDuasCapturas,
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

  // `MESSAGEADD` e `JOINCHAT` chegam juntos (4 ms) e duplicavam a saudação.
  describe('eco do join na abertura da conversa', () => {
    const sessaoRecem = (nascidaEm: string): BotSession =>
      ({
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
        createdAt: new Date(nascidaEm),
      }) as BotSession

    it('join logo depois do início não fala de novo', async () => {
      // Sessão criada 4 ms antes, que é o intervalo medido em produção.
      const { deps, say } = makeDeps({
        sessaoAtiva: sessaoRecem('2026-08-31T11:59:59.996Z'),
      })

      const out = await runBotTurn(
        evento({ kind: 'join', text: '' }),
        LINE,
        APP,
        deps,
      )

      expect(out).toEqual({ kind: 'duplicado', reason: 'join-eco' })
      expect(say).not.toHaveBeenCalled()
    })

    it('join em sessão antiga continua recomeçando', async () => {
      // Bot recolocado numa conversa parada: recomeçar é o comportamento certo.
      const { deps, say } = makeDeps({
        sessaoAtiva: sessaoRecem('2026-08-31T11:00:00Z'),
      })

      const out = await runBotTurn(
        evento({ kind: 'join', text: '' }),
        LINE,
        APP,
        deps,
      )

      expect(out.kind).toBe('ran')
      expect(say).toHaveBeenCalledWith(CHAT, 'Qual seu e-mail?')
    })

    it('mensagem do cliente nunca é descartada como eco', async () => {
      // Descartar a fala perderia o que o cliente escreveu; só o `join` é eco.
      const { deps, say } = makeDeps({
        sessaoAtiva: sessaoRecem('2026-08-31T11:59:59.996Z'),
      })

      const out = await runBotTurn(
        evento({ text: 'nao-e-email' }),
        LINE,
        APP,
        deps,
      )

      expect(out.kind).toBe('ran')
      expect(say).toHaveBeenCalled()
    })

    it('join sem sessão nenhuma roda normalmente', async () => {
      const { deps, say, create } = makeDeps()

      const out = await runBotTurn(
        evento({ kind: 'join', text: '' }),
        LINE,
        APP,
        deps,
      )

      expect(out.kind).toBe('ran')
      expect(say).toHaveBeenCalledOnce()
      expect(create).toHaveBeenCalledOnce()
    })
  })

  it('grava o estado antes de falar', async () => {
    // Falar antes leria a resposta contra a pergunta anterior.
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
      // Antiga o bastante para não cair na janela de eco do `join`.
      createdAt: new Date('2026-08-31T10:00:00Z'),
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

  it('chat já entregue a atendente não recomeça o fluxo', async () => {
    // Bug: a resposta ao atendente abria sessão nova.
    const { deps, say, create, handoff } = makeDeps({
      entregueEm: new Date('2026-08-31T11:30:00Z'),
    })

    const out = await runBotTurn(evento({ text: 'obrigado' }), LINE, APP, deps)

    expect(out).toEqual({
      kind: 'entregue',
      desde: new Date('2026-08-31T11:30:00Z'),
    })
    expect(say).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    // Nem transferir de novo: tiraria a conversa de quem já a assumiu.
    expect(handoff).not.toHaveBeenCalled()
  })

  it('transferência que falha não fica gravada como entrega', async () => {
    // Senão o retry leria `HANDED_OFF` e ficaria mudo.
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
      createdAt: new Date('2026-08-31T10:00:00Z'),
    }

    const { deps, close, handoff } = makeDeps({ sessaoAtiva: sessao })
    handoff.mockRejectedValueOnce(new Error('TRANSFER_ID_EMPTY'))

    await expect(
      runBotTurn(evento({ text: 'gustavo@crmthink.com.br' }), LINE, APP, deps),
    ).rejects.toThrow('TRANSFER_ID_EMPTY')

    expect(close).toHaveBeenCalledWith('sess-1', 'HANDED_OFF')
    expect(close).toHaveBeenLastCalledWith('sess-1', 'ABORTED')
  })

  it('handoff antigo não cala o bot para sempre', async () => {
    const { deps, say } = makeDeps({
      // Passada a janela, a mensagem é atendimento novo no mesmo chat.
      entregueEm: new Date('2026-08-30T12:00:00Z'),
    })

    const out = await runBotTurn(evento({ text: 'oi' }), LINE, APP, deps)

    expect(out.kind).toBe('ran')
    expect(say).toHaveBeenCalled()
  })

  it('join recomeça mesmo com handoff recente: o bot foi recolocado', async () => {
    const { deps, say } = makeDeps({
      entregueEm: new Date('2026-08-31T11:59:00Z'),
    })

    const out = await runBotTurn(
      evento({ kind: 'join', text: '' }),
      LINE,
      APP,
      deps,
    )

    expect(out.kind).toBe('ran')
    expect(say).toHaveBeenCalled()
  })

  it('sessão viva roda o snapshot, não o fluxo republicado', async () => {
    // O `graph` da sessão é a fonte, não o republicado.
    const outroGraph = {
      ...graph,
      nodes: [
        graph.nodes[0],
        { ...graph.nodes[1], text: 'PERGUNTA NOVA' },
        graph.nodes[2],
      ],
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
      // Antiga o bastante para não cair na janela de eco do `join`.
      createdAt: new Date('2026-08-31T10:00:00Z'),
    }

    const { deps, say } = makeDeps({
      sessaoAtiva: sessao,
      flowAtual: { ...flow, version: 4, graph: outroGraph },
    })

    // A fala seguinte distingue snapshot de republicado.
    await runBotTurn(evento({ text: 'x' }), LINE, APP, deps)

    const falas = say.mock.calls.map(c => String(c[1])).join(' ')
    expect(falas).toContain('Anotado.')
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

  it('sem conector ThinkZap ativo não abre sessão', async () => {
    const { deps, say, create } = makeDeps({ connectorAtivo: false })

    const out = await runBotTurn(evento(), LINE, APP, deps)

    expect(out).toEqual({ kind: 'skipped', reason: 'sem-conector-ativo' })
    expect(say).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('sessão em andamento termina mesmo com o conector vencido', async () => {
    const sessao = {
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
      createdAt: new Date('2026-08-31T11:00:00Z'),
    } as BotSession
    const { deps, connectorAtivo } = makeDeps({
      sessaoAtiva: sessao,
      connectorAtivo: false,
    })

    const out = await runBotTurn(evento(), LINE, APP, deps)

    expect(out.kind).toBe('ran')
    expect(connectorAtivo).not.toHaveBeenCalled()
  })

  it('não consulta o conector quando o vínculo já barrou', async () => {
    const { deps, connectorAtivo } = makeDeps({ bindingAtual: null })

    await runBotTurn(evento(), LINE, APP, deps)

    expect(connectorAtivo).not.toHaveBeenCalled()
  })

  it('não cria sessão quando o fluxo termina no primeiro passo', async () => {
    // Row `ACTIVE` sem próximo nó bloquearia o chat até expirar.
    const soHandoff = {
      entryNodeId: 'entrega',
      settings: { escapeKeywords: [], escapeTarget: null },
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
    // Operador apagado no Bitrix após a publicação: id vazio deixaria o chat órfão.
    const alvoVazio = {
      entryNodeId: 'entrega',
      settings: { escapeKeywords: [], escapeTarget: null },
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

describe('runBotTurn idioma do resumo', () => {
  const sessaoNaPergunta = {
    id: 'sess-1',
    appId: APP,
    chatId: CHAT,
    flowId: 'flow-1',
    flowVersion: 3,
    currentNodeId: 'ask',
    vars: {},
    attempts: 0,
    graph,
    bindingId: 'bind-1',
    status: 'ACTIVE',
    createdAt: new Date('2026-08-31T11:59:00Z'),
    updatedAt: new Date('2026-08-31T11:59:00Z'),
  } as unknown as BotSession

  it('o idioma da instalação chega ao resumo sussurrado na transferência', async () => {
    const { deps } = makeDeps({ sessaoAtiva: sessaoNaPergunta })

    await runBotTurn(evento({ text: 'maria@x.com' }), LINE, APP, {
      ...deps,
      locale: 'en',
    })

    const whisper = vi.mocked(deps.session).whisper.mock
    const resumo = whisper.calls[0]?.[1]
    expect(resumo?.split('\n')[0]).toBe('Automated service summary')
    expect(resumo).toContain('maria@x.com')
  })

  it('sem idioma: resumo em português', async () => {
    const { deps } = makeDeps({ sessaoAtiva: sessaoNaPergunta })

    await runBotTurn(evento({ text: 'maria@x.com' }), LINE, APP, deps)

    const whisper = vi.mocked(deps.session).whisper.mock
    expect(whisper.calls[0]?.[1]).toMatch(/^Resumo do atendimento automático/)
  })
})
