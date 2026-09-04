import { BOT_CODE } from '@/modules/thinkzap/application/ensure-bot-flow-bot'
import { runBotTurn } from '@/modules/thinkzap/application/run-bot-turn'
import { parseBotEvent } from '@/modules/thinkzap/domain/bot-flow/bot-event'
import { openLineIdFromDialog } from '@/modules/thinkzap/domain/bot-flow/open-line-entity-id'
import {
  crmEntitiesFromDialog,
  crmVars,
} from '@/modules/thinkzap/domain/bot-flow/crm-entities'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { BitrixBotSessionAdapter } from '@/modules/thinkzap/infra/adapters/bitrix-bot-session.adapter'
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
    const crm = crmVars(crmEntitiesFromDialog(dialog))

    /**
     * Uma fala, um caminho: o adapter escreve com `imbot.v2.Chat.Message.send`, que sai
     * como mensagem de participante e o canal aberto repassa ao conector — o mesmo
     * transporte que leva a fala do operador ao destino final, qualquer que seja o
     * conector daquele canal.
     */
    const sessao = new BitrixBotSessionAdapter(
      client,
      bot.botToken,
      bot.bitrixBotId,
    )

    const outcome = await runBotTurn(
      event,
      lineId,
      installedApp.id,
      {
        session: sessao,
        sessions,
        flows,
        bindings,
      },
      crm,
    )

    if (outcome.kind === 'duplicado') {
      // Rede de segurança do lock: cobre o evento que chega depois de o lock ter sido
      // liberado, quando a sessão do turno anterior já está gravada.
      await ctx.appendJobLog(`Evento repetido | motivo=${outcome.reason}`)
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
