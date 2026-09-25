import { adoptLineBinding } from '@/modules/thinkzap/application/adopt-line-binding'
import { BOT_CODE } from '@/modules/thinkzap/application/ensure-bot-flow-bot'
import { runBotTurn } from '@/modules/thinkzap/application/run-bot-turn'
import { parseBotEvent } from '@/modules/thinkzap/domain/bot-flow/bot-event'
import {
  contactNameFromDialog,
  openLineIdFromDialog,
} from '@/modules/thinkzap/domain/bot-flow/open-line-entity-id'
import {
  crmEntitiesFromDialog,
  crmVars,
} from '@/modules/thinkzap/domain/bot-flow/crm-entities'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { BitrixBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-bot-session.adapter'
import { HybridBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/hybrid-bot-session.adapter'
import { makeBitrixWebhookContextRepository } from '@/modules/thinkzap/main/make-bitrix-webhook-context-repository'
import { makeOutboundSenderResolver } from '@/modules/thinkzap/main/make-outbound-sender-resolver'
import { resolveByMarketplaceCode } from '@/shared/app-catalog/app-catalog'
import { env } from '@/config/env'
import type { BotSessionPort } from '@/modules/thinkzap/domain/ports/bot-session.port'
import { PrismaBotFlowBindingRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow-binding.repository'
import { PrismaBotFlowBotRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow-bot.repository'
import { PrismaBotFlowRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-flow.repository'
import { PrismaBotSessionRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-bot-session.repository'
import { acquireBotChatLock } from '@/modules/thinkzap/infra/queue/bot-chat-lock'
import { redisConnection } from '@/queue/redis-connection'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import type { AppendJobLog } from '@/modules/thinkzap/domain/ports/job-log.port'

const log = createWorkerSourceLogger('bitrix')

const sessions = new PrismaBotSessionRepository()
const flows = new PrismaBotFlowRepository()
const bindings = new PrismaBotFlowBindingRepository()
const bots = new PrismaBotFlowBotRepository()

// Um evento `ONIMBOTV2*` do bot do fluxo. Só orquestra: aqui ficam as resoluções que
// exigem I/O — instalação pelo domínio, linha pelo chat, e o `botToken` das chamadas de
// volta.
export async function processBitrixBotEvent(
  body: unknown,
  ctx: { appendJobLog: AppendJobLog },
): Promise<void> {
  const event = parseBotEvent(body, BOT_CODE)

  if (event.kind === 'ignore') {
    // Caminho normal, não erro: mensagem do operador, aviso de sistema e evento de outro
    // bot chegam no mesmo endereço. Vai para o log do job para distinguir "não devia
    // rodar" de "devia e não rodou".
    await ctx.appendJobLog(`Evento ignorado | motivo=${event.ignoreReason}`)
    return
  }

  if (!event.domain) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      { chatId: event.chatId, kind: event.kind },
      {
        level: 'warn',
        msg: 'Evento do bot sem domínio — sem como resolver a instalação',
      },
    )
    return
  }

  const domain = await new PrismaDomainRepository().getDomain(event.domain)
  if (!domain) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      { domain: event.domain, chatId: event.chatId },
      {
        level: 'warn',
        msg: 'Domínio do evento não corresponde a nenhuma instalação',
      },
    )
    return
  }

  const installedApp =
    await new PrismaInstalledAppRepository().getByAppCodeAndDomainId(
      thinkzapAppCodeId(),
      domain.id,
    )
  if (!installedApp) {
    logThinkzapError(
      log,
      'thinkzap.app.not_found',
      { domain: event.domain, domainId: domain.id },
      { level: 'error' },
    )
    return
  }

  const credential = await new PrismaCredentialRepository().get({
    appId: installedApp.id,
  })
  if (!credential) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      { appId: installedApp.id },
      {
        level: 'error',
        msg: 'Instalação sem credencial — não é possível responder',
      },
    )
    return
  }

  // `botToken` do banco, não do evento: é a chave que geramos no registro e a única cópia
  // dela. Sem ela `transfer` e `finish` não identificam o bot chamador.
  const bot = await bots.getByAppId(installedApp.id)
  if (!bot) {
    logThinkzapError(
      log,
      'thinkzap.bot.event_unresolved',
      { appId: installedApp.id, chatId: event.chatId },
      {
        level: 'error',
        msg: 'Evento de bot sem registro nosso — o bot existe no portal e não no banco',
      },
    )
    return
  }

  const client = new BitrixClient({
    bitrixCredential: credential,
    domain: domain.name,
  })

  /**
   * Um turno por chat de cada vez, do `dialog.get` até a última fala.
   *
   * O Bitrix dispara `MESSAGEADD` e `JOINCHAT` no mesmo instante na abertura da conversa
   * (medido: 4 ms), e a fila roda com `concurrency: 10`. Os dois jobs entravam em
   * paralelo, **nenhum via a sessão criada pelo outro**, e os dois rodavam o fluxo do
   * início — o cliente recebia a saudação duas vezes.
   *
   * Descarta o concorrente em vez de esperar: é justamente o evento que não deve rodar de
   * novo, e segurar um slot bloqueado reduziria dez workers a um.
   */
  const lock = await acquireBotChatLock(
    redisConnection,
    installedApp.id,
    event.chatId,
  )
  if (!lock) {
    await ctx.appendJobLog(
      `Turno concorrente no mesmo chat (${event.chatId}) — evento descartado.`,
    )
    return
  }

  try {
    // O evento traz `chat.id` e o vínculo é por `CONFIG_ID` da linha: `dialog.get` é a
    // única ponte entre os dois, uma chamada por evento.
    const dialog = await client.callMethod('imopenlines.dialog.get', {
      CHAT_ID: event.chatId,
    })

    const lineId = openLineIdFromDialog(dialog)
    if (!lineId) {
      logThinkzapError(
        log,
        'thinkzap.bot.event_unresolved',
        { chatId: event.chatId, appId: installedApp.id },
        {
          level: 'warn',
          msg: 'Chat sem linha de canal aberto — dialog.get não devolveu entity_id de LINES',
        },
      )
      return
    }

    await ctx.appendJobLog(
      `Turno do bot | chat=${event.chatId} | linha=${lineId} | tipo=${event.kind}`,
    )

    // Da mesma resposta do `dialog.get`, sem chamada extra: o `entity_data_2` traz os
    // vínculos de CRM do chat, e é o que o bloco "Já é cliente?" compara.
    // Nome do chat como reserva: o `JOINCHAT` não traz o autor, e é o turno da saudação.
    const crm = crmVars(crmEntitiesFromDialog(dialog), {
      name: event.authorName || contactNameFromDialog(dialog),
    })

    const eco = new BitrixBotSessionAdapter(
      client,
      bot.botToken,
      bot.bitrixBotId,
    )

    const sessao = await comEntregaAoContato(eco, {
      domain: domain.name,
      lineId,
      chatId: event.chatId,
      appendJobLog: ctx.appendJobLog,
    })

    const deps = {
      session: sessao,
      sessions,
      flows,
      bindings,
    }

    let outcome = await runBotTurn(event, lineId, installedApp.id, deps, crm)

    /**
     * Canal ligado pelo painel do Bitrix, e não pela nossa tela: registra o vínculo e roda
     * o turno que acabou de não ter fluxo.
     *
     * `sem-vinculo` só, das razões de skip: as outras dizem que o vínculo existe e está
     * impedido (inativo, fluxo fora do ar), e criar outro por cima passaria por cima de
     * uma decisão que o cliente tomou.
     */
    if (outcome.kind === 'skipped' && outcome.reason === 'sem-vinculo') {
      const adotado = await adoptLineBinding(installedApp.id, lineId, {
        flows,
        bindings,
      })

      if (adotado) {
        await ctx.appendJobLog(
          `Canal adotado | linha=${lineId} | fluxo=${adotado.flowId} — ` +
            'bot configurado pelo painel do Bitrix ganhou vínculo.',
        )
        outcome = await runBotTurn(event, lineId, installedApp.id, deps, crm)
      }
    }

    if (outcome.kind === 'duplicado') {
      // Rede de segurança do lock: cobre o evento que chega depois de o lock ter sido
      // liberado, quando a sessão do turno anterior já está gravada.
      await ctx.appendJobLog(`Evento repetido | motivo=${outcome.reason}`)
      return
    }

    if (outcome.kind === 'entregue') {
      // Antes do `skipped` de propósito: lá o desfecho é transferir para a fila, e aqui a
      // conversa já está com um atendente — transferir de novo a tiraria dele.
      await ctx.appendJobLog(
        `Chat com atendimento humano desde ${outcome.desde.toISOString()} — bot calado.`,
      )
      return
    }

    if (outcome.kind === 'gone') {
      // Sem handoff para a fila: o bot não fala mais neste chat, então transferir
      // falharia pelo mesmo motivo. Quem assumiu a conversa já está com ela.
      await ctx.appendJobLog(`Bot fora da sessão | código=${outcome.code}`)
      return
    }

    if (outcome.kind === 'skipped') {
      // Bot na linha e nenhum fluxo para rodar: vai para a fila em vez de chat mudo.
      // Acontece se o `unbind` falhou, se o fluxo foi despublicado com vínculo ativo, ou
      // se o vínculo foi apagado direto no banco.
      logThinkzapError(
        log,
        'thinkzap.bot.turn_skipped',
        {
          chatId: event.chatId,
          lineId,
          appId: installedApp.id,
          reason: outcome.reason,
        },
        {
          level: 'warn',
          msg: `Turno sem fluxo (${outcome.reason}) — entregando para a fila`,
        },
      )

      await ctx.appendJobLog(`Sem fluxo | motivo=${outcome.reason} | fila`)
      await sessao.handoff(event.chatId, { type: 'queue' })
      return
    }

    await ctx.appendJobLog(
      `Turno concluído | efeitos=${outcome.effects.length}`,
    )
  } finally {
    await lock.release()
  }
}

/**
 * Envolve o adapter do bot no `HybridBotSessionAdapter`, que entrega a fala ao contato
 * pelo mesmo caminho do operador.
 *
 * Escrever no chat do canal aberto **não** faz a mensagem chegar ao WhatsApp: o Bitrix não
 * dispara `ONIMCONNECTORMESSAGEADD` pela fala do bot, e é esse evento que o ThinkZap
 * escuta para despachar ao provider. Sem isto a saudação aparece no chat, o operador a lê,
 * e o cliente nunca recebe nada — ver `HybridBotSessionAdapter`.
 *
 * O contexto é resolvido pela linha, a mesma chave do fluxo de mensagem do operador.
 * Quando não resolve (canal aberto sem conector do ThinkZap — Telegram, site, outro app),
 * segue só com o eco: o Bitrix entrega ao conector daquele canal por conta própria, e um
 * envio nosso não teria para onde ir.
 */
async function comEntregaAoContato(
  eco: BotSessionPort,
  input: {
    domain: string
    lineId: string
    chatId: string
    appendJobLog: AppendJobLog
  },
): Promise<BotSessionPort> {
  const appCode = resolveByMarketplaceCode(env.appCodes.thinkzap)?.appCodeId

  if (!appCode) return eco

  const context = await makeBitrixWebhookContextRepository().getContext({
    domainName: input.domain,
    appCode,
    line: input.lineId,
  })

  if (!context) {
    await input.appendJobLog(
      `Canal sem conector ThinkZap (linha=${input.lineId}) — fala entregue só pelo chat ` +
        'do canal aberto, que é quem repassa ao conector daquele canal.',
    )
    return eco
  }

  const contato = makeOutboundSenderResolver().resolve(
    context.connector.provider,
    {
      instanceId: context.instance.instanceId,
      zApiToken: context.instance.zApiToken,
      channelId: context.instance.channelId,
      chatId: input.chatId,
    },
  )

  await input.appendJobLog(
    `Entrega ao contato por ${context.connector.provider} | ` +
      `instância=${context.instance.instanceId}`,
  )

  return new HybridBotSessionAdapter(eco, contato)
}
