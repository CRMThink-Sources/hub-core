import 'dotenv/config'

import { env } from '@/config/env'
import { ensureBitrixBotId } from '@/modules/thinkzap/application/ensure-bitrix-bot-id'
import { redisConnection } from '@/queue/redis-connection'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'

/**
 * Descobre por que o aviso do bot não aparece no chat do canal aberto.
 *
 * **Por que existe:** `imbot.message.add` recusa com **HTTP 200** e `error` no corpo, e
 * `BitrixClient.callMethod` só lança quando o transporte falha. O resultado é o pior
 * sintoma possível: log dizendo "aviso postado" e chat sem nada. Este script imprime a
 * resposta **crua** de cada chamada, que é a única coisa que separa as causas possíveis:
 *
 * - `error: BOT_ID_ERROR` / bot de outro app → o `botId` resolvido não pertence a esta
 *   instalação;
 * - `error` de diálogo/acesso → o bot não é participante daquele chat, e para OL isso
 *   exige `imbot.chat.user.add` (ou o bot precisa ser do tipo que o OL aceita);
 * - `result: <id>` com o chat certo → a mensagem existe e o problema é onde se olha:
 *   sessão de OL encerrada abre chat novo, e o aviso foi para o antigo.
 *
 * Ordem das checagens: primeiro o que o bot é, depois o que o chat é, e só então a
 * postagem. Postar antes de saber isso é o que produz "não apareceu" sem pista.
 *
 * Uso:
 *   yarn check:bitrix-bot-notice <domínio> <chatId> [--post]
 *
 * Ex.: yarn check:bitrix-bot-notice crmthinkers.bitrix24.com.br 9474
 *
 * **Sem `--post` não escreve nada** — só lê bot e diálogo. Com `--post`, percorre a
 * matriz de métodos (bot/usuário do app × sistema/normal) e **para no primeiro que
 * criar mensagem**: cada sucesso é texto visível no chat de um cliente, e o que se quer
 * saber é qual método usar, não quantos funcionam. Usar só em chat combinado.
 */

const TEST_NOTICE =
  '🔧 Teste de diagnóstico do conector (pode ignorar esta mensagem).'

function parseArgs() {
  const [domain, chatId, ...rest] = process.argv.slice(2)

  if (!domain || !chatId) {
    console.error(
      'Uso: yarn check:bitrix-bot-notice <domínio> <chatId> [--post]',
    )
    process.exit(1)
  }

  return { domain, chatId, post: rest.includes('--post') }
}

async function main() {
  const { domain, chatId, post } = parseArgs()
  const dialogId = `chat${chatId}`

  console.log(`Portal: ${domain}`)
  console.log(`Diálogo: ${dialogId}`)
  console.log(`Modo: ${post ? 'LEITURA + POSTAGEM (--post)' : 'só leitura'}\n`)

  const bitrix = await makeBitrixClientByDomainAndAppCoode(
    domain,
    thinkzapAppCodeId(),
  )

  console.log('— imbot.v2.Bot.list —')
  const bots = await bitrix.callMethod('imbot.v2.Bot.list', {})
  console.log(JSON.stringify(bots, null, 2))

  /**
   * Mesma resolução (e mesmo cache Redis) do caminho de produção: um `botId` diferente
   * aqui significaria que o script está diagnosticando outra coisa.
   */
  const botId = await ensureBitrixBotId(
    bitrix,
    redisConnection,
    domain,
    env.appCodes.thinkzap,
  )
  console.log(`\nbotId resolvido (mesma chave do worker): ${botId}\n`)

  console.log('— im.dialog.get —')
  try {
    const dialog = await bitrix.callMethod('im.dialog.get', {
      DIALOG_ID: dialogId,
    })
    console.log(JSON.stringify(dialog, null, 2))
  } catch (err) {
    console.log(`falhou: ${err instanceof Error ? err.message : String(err)}`)
  }

  console.log('\n— im.dialog.users.list (o bot está no chat?) —')
  try {
    const users = await bitrix.callMethod('im.dialog.users.list', {
      DIALOG_ID: dialogId,
    })
    console.log(JSON.stringify(users, null, 2))
  } catch (err) {
    console.log(`falhou: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!post) {
    console.log(
      '\nNada foi postado. Rode de novo com --post para tentar a mensagem de teste ' +
        'no chat indicado.',
    )
    return
  }

  /**
   * Matriz de candidatos, na ordem em que interessa saber.
   *
   * `imbot.message.add` sem `SYSTEM` já foi medido: `CANCELED` — "Você não pode enviar
   * mensagens para o bate-papo especificado". Fica na lista como controle: é ele que
   * diz se a barreira é a **escrita no chat** (todas recusam) ou o **modo da mensagem**
   * (a versão SYSTEM passa).
   *
   * Para no primeiro sucesso: cada sucesso cria mensagem visível no chat de um cliente,
   * e o que se quer saber é qual método usar — não quantos funcionam.
   */
  const candidates: Array<{
    label: string
    method: string
    payload: Record<string, unknown>
  }> = [
    {
      label: 'bot, mensagem de sistema',
      method: 'imbot.message.add',
      payload: {
        BOT_ID: botId,
        DIALOG_ID: dialogId,
        MESSAGE: TEST_NOTICE,
        SYSTEM: 'Y',
      },
    },
    {
      label: 'usuário do app, mensagem de sistema',
      method: 'im.message.add',
      payload: { DIALOG_ID: dialogId, MESSAGE: TEST_NOTICE, SYSTEM: 'Y' },
    },
    {
      label: 'usuário do app, mensagem normal (controle)',
      method: 'im.message.add',
      payload: { DIALOG_ID: dialogId, MESSAGE: TEST_NOTICE },
    },
    {
      label: 'bot, mensagem normal (controle — já recusado em produção)',
      method: 'imbot.message.add',
      payload: { BOT_ID: botId, DIALOG_ID: dialogId, MESSAGE: TEST_NOTICE },
    },
  ]

  for (const { label, method, payload } of candidates) {
    console.log(`\n— ${method} [${label}] —`)
    console.log(`params: ${JSON.stringify(payload)}`)

    try {
      const response = await bitrix.callMethod<{
        result?: number | string | false
      }>(method, payload)
      console.log(JSON.stringify(response, null, 2))

      if (response?.result) {
        console.log(
          `\n✔ FUNCIONOU: ${method} ${payload.SYSTEM ? 'com' : 'sem'} SYSTEM ` +
            `criou a mensagem ${JSON.stringify(response.result)} [${label}].\n` +
            'Confirmar na tela como o texto aparece (serviço cinza x mensagem de autor) ' +
            'e fixar este método no código.',
        )
        return
      }
    } catch (err) {
      console.log(
        `falhou no transporte: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  console.log(
    '\n✖ Nenhum método criou mensagem neste chat. A barreira é escrita no chat, não o ' +
      'modo da mensagem — próximos caminhos: adicionar o bot/usuário ao chat ' +
      '(`imbot.chat.user.add` / `im.chat.user.add`, que altera participantes do chat do ' +
      'cliente) ou trocar de superfície (comentário na timeline do CRM).',
  )
}

main()
  .catch(error => {
    console.error('Falha no diagnóstico:', error)
    process.exit(1)
  })
  .finally(() => {
    void redisConnection.quit()
  })
