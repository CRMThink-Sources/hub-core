import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { thinkzapError } from '../errors/catalog'

const log = createWorkerSourceLogger('bitrix')

// Segundos até o Bitrix tirar o bot da conversa. Alto porque quem entrega para humano é o
// bloco de entrega do fluxo: valor baixo tiraria o bot no meio de uma pergunta.
const WELCOME_BOT_TIME = 3600

type ConfigGetResponse = {
  result?: {
    WELCOME_BOT_ENABLE?: string
    WELCOME_BOT_ID?: string | number
    LINE_NAME?: string
  }
}

/**
 * Recusa a linha que já tem bot de saudação de outro app.
 *
 * O Bitrix guarda **um** `WELCOME_BOT_ID` por linha, então vincular sobrescreve o que
 * estava lá. Sem esta checagem o bot do terceiro sai de operação em silêncio, e não há
 * como devolvê-lo: nosso `unbind` desliga a saudação, não restaura o dono anterior.
 *
 * Recusar em vez de guardar-e-restaurar porque o backup envelhece — o cliente pode mexer
 * na configuração pelo painel no meio, e restaurar por cima disso é pior que não
 * restaurar.
 */
async function assertLinhaLivre(
  client: BitrixClient,
  input: { lineId: string; bitrixBotId: number; ownBotIds?: number[] },
): Promise<void> {
  const response = await client.callMethod<ConfigGetResponse>(
    'imopenlines.config.get',
    { CONFIG_ID: input.lineId },
  )

  const config = response.result
  const ocupada = String(config?.WELCOME_BOT_ENABLE ?? '') === 'Y'
  const botDaLinha = Number(config?.WELCOME_BOT_ID ?? 0)

  // Bot nosso não conta: revincular a mesma linha é idempotente (reativar vínculo
  // desligado), e o bot de outro fluxo do mesmo app pode ter sido posto pelo painel.
  if (!ocupada || !botDaLinha || botDaLinha === input.bitrixBotId) return
  if (input.ownBotIds?.includes(botDaLinha)) return

  log.warn(
    {
      lineId: input.lineId,
      botDaLinha,
      nosso: input.bitrixBotId,
      lineName: config?.LINE_NAME ?? null,
    },
    'Linha já tem bot de saudação de outro app — vínculo recusado',
  )

  throw thinkzapError('thinkzap.bot.line_has_other_bot')
}

// `JOIN: always` porque o fluxo é o atendimento, não uma saudação da primeira sessão do
// contato; `LEFT: queue` é a rede de segurança se o fluxo morrer no meio.
export async function bindWelcomeBot(
  client: BitrixClient,
  input: { lineId: string; bitrixBotId: number; ownBotIds?: number[] },
): Promise<void> {
  await assertLinhaLivre(client, input)

  await client.callMethod('imopenlines.config.update', {
    CONFIG_ID: input.lineId,
    PARAMS: {
      WELCOME_BOT_ENABLE: 'Y',
      WELCOME_BOT_ID: input.bitrixBotId,
      WELCOME_BOT_JOIN: 'always',
      WELCOME_BOT_LEFT: 'queue',
      WELCOME_BOT_TIME,
    },
  })

  await assertWelcomeBot(client, input)
}

// Desliga o bot da linha; ele segue registrado para outras linhas do fluxo. Relê pelo
// mesmo motivo do `bind`, com consequência pior: quem chama apaga o vínculo em seguida, e
// um `update` que não persistiu deixaria o bot ativo numa linha sem fluxo.
export async function unbindWelcomeBot(
  client: BitrixClient,
  input: { lineId: string },
): Promise<void> {
  await client.callMethod('imopenlines.config.update', {
    CONFIG_ID: input.lineId,
    PARAMS: {
      WELCOME_BOT_ENABLE: 'N',
      // Zerado junto, e não só desabilitado: quem chama pode desregistrar o bot em
      // seguida (`removeBotIfUnused`), e o id ficaria na linha apontando para um bot que
      // não existe mais. Reativar a saudação pelo painel do Bitrix chamaria um bot morto.
      WELCOME_BOT_ID: 0,
    },
  })

  const response = await client.callMethod<ConfigGetResponse>(
    'imopenlines.config.get',
    { CONFIG_ID: input.lineId },
  )

  if (String(response.result?.WELCOME_BOT_ENABLE ?? '') === 'Y') {
    log.error(
      { lineId: input.lineId, botId: response.result?.WELCOME_BOT_ID ?? null },
      'config.update respondeu ok mas o welcome bot continua ligado na linha',
    )
    throw thinkzapError('thinkzap.bot.line_unbind_failed')
  }
}

// `imopenlines.config.update` responde `true` sem garantir que o campo persistiu; quem
// prova o vínculo é o `config.get`. Sem isso o vínculo seria gravado no nosso banco com a
// linha ainda sem bot.
async function assertWelcomeBot(
  client: BitrixClient,
  input: { lineId: string; bitrixBotId: number },
): Promise<void> {
  const response = await client.callMethod<ConfigGetResponse>(
    'imopenlines.config.get',
    { CONFIG_ID: input.lineId },
  )

  const config = response.result
  const habilitado = String(config?.WELCOME_BOT_ENABLE ?? '') === 'Y'
  const idNaLinha = Number(config?.WELCOME_BOT_ID ?? 0)

  if (!habilitado || idNaLinha !== input.bitrixBotId) {
    log.error(
      {
        lineId: input.lineId,
        esperado: input.bitrixBotId,
        encontrado: idNaLinha || null,
        habilitado,
      },
      'config.update respondeu ok mas o welcome bot não persistiu',
    )
    throw thinkzapError('thinkzap.bot.line_bind_failed')
  }
}
