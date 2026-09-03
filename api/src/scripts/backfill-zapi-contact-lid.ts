import 'dotenv/config'

import { randomUUID } from 'node:crypto'
import { env } from '@/config/env'
import { prisma } from '@/config/prisma.js'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { decideBackfill } from './backfill-zapi-contact-lid.decision'

/**
 * Monta o mapa `lid ↔ telefone` para os contatos que **já têm conversa aberta**, e
 * marca a identidade legada deles.
 *
 * **Por que existe.** A identidade do contato no canal aberto passa a ser o LID. Trocar
 * o `chat.id` de um contato faz o Bitrix abrir uma conversa nova — o `imconnector` não
 * oferece remapear —, então sem este passo o deploy produziria uma conversa duplicada
 * para **todo** contato Z-API ativo. Uma onda de duplicidade no dia do conserto da
 * duplicidade.
 *
 * O que ele grava em `legacy_phone_identity` é o `chat_id` que aquele contato já usa.
 * A resolução em runtime prefere esse valor ao LID, então contato antigo continua na
 * conversa dele e contato novo nasce com LID.
 *
 * **Roda antes de ligar `THINKZAP_ZAPI_LID_IDENTITY`.** Depois é tarde: as conversas já
 * terão sido abertas com a chave nova.
 *
 * Escreve só com `--apply`. Sem a flag é relatório — é escrita em tabela de produção, e
 * o default seguro é não tocar em nada.
 *
 * Idempotente: `legacy_phone_identity` já preenchida nunca é sobrescrita, então rodar de
 * novo só cobre o que faltou. É o que torna seguro rodar em pedaços, ou repetir depois
 * de uma queda no meio.
 */

type Report = {
  distinct: number
  resolved: number
  notOnWhatsApp: number
  failed: number
  alreadyMapped: number
  skippedNotPhone: number
}

function parseArgs(): { apply: boolean; delayMs: number } {
  const args = process.argv.slice(2)
  const delayArg = args.find(arg => arg.startsWith('--delay-ms='))
  return {
    apply: args.includes('--apply'),
    /**
     * Pausa entre chamadas. O limite de taxa da Z-API para `phone-exists` não está
     * documentado, então o default é conservador — é preferível o backfill demorar a
     * ser bloqueado no meio e deixar metade dos contatos sem proteção.
     */
    delayMs: Number(delayArg?.split('=')[1] ?? 200) || 0,
  }
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

/**
 * Instâncias Z-API com token. Sem token não há como consultar `phone-exists`, e a
 * instância é reportada em vez de silenciosamente pulada.
 */
async function loadZApiInstances() {
  return prisma.instance.findMany({
    where: { zApiToken: { not: null } },
    select: { id: true, instanceId: true, zApiToken: true },
  })
}

/** Row já marcada pelo backfill numa execução anterior. É o guard de idempotência. */
async function hasLegacyIdentity(
  instanceDbId: string,
  phone: string,
): Promise<boolean> {
  const row = await prisma.thinkzapContactIdentity.findUnique({
    where: {
      uq_identity_instance_phone: { instanceId: instanceDbId, phone },
    },
  })
  return Boolean(row?.legacyPhoneIdentity)
}

async function distinctChatIds(instanceDbId: string): Promise<string[]> {
  const rows = await prisma.thinkzapMessage.findMany({
    where: { instanceId: instanceDbId, chatId: { not: null } },
    select: { chatId: true },
    distinct: ['chatId'],
  })

  return rows
    .map(row => row.chatId)
    .filter((chatId): chatId is string => Boolean(chatId))
}

async function main(): Promise<void> {
  const { apply, delayMs } = parseArgs()
  const client = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  const instances = await loadZApiInstances()
  console.log(
    `[backfill-lid] ${instances.length} instância(s) Z-API com token. ` +
      `Modo: ${apply ? 'APPLY (escreve)' : 'DRY-RUN (não escreve)'}, delay ${delayMs}ms.`,
  )

  const total: Report = {
    distinct: 0,
    resolved: 0,
    notOnWhatsApp: 0,
    failed: 0,
    alreadyMapped: 0,
    skippedNotPhone: 0,
  }

  for (const instance of instances) {
    const chatIds = await distinctChatIds(instance.id)
    total.distinct += chatIds.length

    console.log(
      `[backfill-lid] instância ${instance.instanceId}: ${chatIds.length} chat_id distinto(s)`,
    )

    for (const chatId of chatIds) {
      /**
       * A consulta ao provider só acontece depois de a decisão descartar os casos que
       * não precisam dela — `chat_id` que já é LID ou grupo, e contato já marcado. É o
       * que mantém o custo do backfill proporcional ao que falta, e o que torna seguro
       * repetir a execução.
       */
      const preliminary = decideBackfill({
        chatId,
        hasLegacyIdentity: await hasLegacyIdentity(instance.id, chatId),
        // Ainda não consultamos; `null` aqui só chega ao ramo `failed` se os guards
        // anteriores passarem, e nesse caso a consulta acontece logo abaixo.
        phoneExists: null,
      })

      if (preliminary.kind === 'skip-not-phone') {
        total.skippedNotPhone += 1
        continue
      }
      if (preliminary.kind === 'already-mapped') {
        total.alreadyMapped += 1
        continue
      }

      const found = await client.phoneExists(
        instance.instanceId,
        instance.zApiToken as string,
        chatId,
      )
      await sleep(delayMs)

      const decision = decideBackfill({
        chatId,
        hasLegacyIdentity: false,
        phoneExists: found,
      })

      if (decision.kind === 'failed') {
        total.failed += 1
        console.warn(`[backfill-lid]   ${chatId}: consulta falhou`)
        continue
      }

      if (decision.kind === 'not-on-whatsapp') {
        total.notOnWhatsApp += 1
        continue
      }

      if (decision.kind !== 'map') continue

      total.resolved += 1

      if (!apply) continue

      await prisma.thinkzapContactIdentity.upsert({
        where: {
          uq_identity_instance_lid: {
            instanceId: instance.id,
            lid: decision.lid,
          },
        },
        create: {
          id: randomUUID(),
          instanceId: instance.id,
          lid: decision.lid,
          phone: decision.phone,
          legacyPhoneIdentity: decision.phone,
        },
        // Row aprendida em runtime antes do backfill ganha aqui a marca de legado —
        // é o único lugar que escreve essa coluna.
        update: { phone: decision.phone, legacyPhoneIdentity: decision.phone },
      })
    }
  }

  console.log('[backfill-lid] ---------------- relatório ----------------')
  console.log(`  chat_id distintos .............. ${total.distinct}`)
  console.log(`  já mapeados (pulados) .......... ${total.alreadyMapped}`)
  console.log(`  não são telefone (lid/grupo) ... ${total.skippedNotPhone}`)
  console.log(`  lid resolvido .................. ${total.resolved}`)
  console.log(`  sem WhatsApp (exists:false) .... ${total.notOnWhatsApp}`)
  console.log(`  falharam ....................... ${total.failed}`)

  if (!apply) {
    console.log(
      '[backfill-lid] DRY-RUN: nada foi gravado. Repetir com --apply.',
    )
  }

  if (total.failed > 0) {
    console.warn(
      `[backfill-lid] ${total.failed} contato(s) sem lid resolvido. Eles vão abrir ` +
        'conversa nova quando a flag for ligada — rodar de novo antes de ligar.',
    )
  }
}

main()
  .catch(err => {
    console.error('[backfill-lid] falhou:', err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
