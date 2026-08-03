import 'dotenv/config'

import { prisma } from '@/config/prisma.js'
import {
  findAnchorCollisions,
  resolveAnchor,
  type InstanceRow,
} from './resolve-message-anchor'

/**
 * Traduz `instance_id` de `core_thinkerszap_messages` e `_conversations` do uuid de
 * `core_thinkerszap_instances` para o **id da instância no provider**.
 *
 * Roda **antes** da troca de constraints: enquanto as unique antigas e as FKs estão
 * de pé, o resultado é verificável e reversível. Ver o Migration Plan de
 * `retire-instance-table`.
 *
 * Escreve só com `--apply`. Sem a flag é relatório — é migração de dado em tabela
 * de produção, e o default seguro é não tocar em nada.
 *
 * Idempotente por construção: traduz apenas as linhas cujo `instance_id` ainda
 * casa com um `Instance.id`. Depois de traduzido, o valor é id de provider e não
 * casa mais com nenhum uuid, então rodar de novo não faz nada.
 */

/** Instâncias são poucas por instalação, mas o UPDATE vai em lote de qualquer forma. */
const BATCH_SIZE = 50

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.slice(2).includes('--apply') }
}

async function loadInstances(): Promise<InstanceRow[]> {
  const rows = await prisma.instance.findMany({
    select: {
      id: true,
      instanceId: true,
      channelId: true,
      connector: { select: { provider: true } },
    },
  })

  return rows.map(row => ({
    id: row.id,
    instanceId: row.instanceId,
    channelId: row.channelId,
    provider: row.connector?.provider ?? null,
  }))
}

async function countPending(
  table: 'core_thinkerszap_messages' | 'core_thinkerszap_conversations',
  uuids: string[],
): Promise<number> {
  if (uuids.length === 0) return 0

  const rows = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
    `SELECT COUNT(*) AS total FROM ${table} WHERE instance_id IN (${uuids
      .map(() => '?')
      .join(',')})`,
    ...uuids,
  )

  return Number(rows[0]?.total ?? 0)
}

/**
 * `UPDATE ... WHERE instance_id = ?` por instância, em lote por transação: são
 * poucas instâncias e muitas mensagens, então uma query por instância é a forma
 * barata. Linha a linha em `messages` seria inviável.
 */
async function translate(
  table: 'core_thinkerszap_messages' | 'core_thinkerszap_conversations',
  pairs: { uuid: string; anchor: string }[],
): Promise<number> {
  let affected = 0

  for (let start = 0; start < pairs.length; start += BATCH_SIZE) {
    const batch = pairs.slice(start, start + BATCH_SIZE)

    for (const { uuid, anchor } of batch) {
      const count = await prisma.$executeRawUnsafe(
        `UPDATE ${table} SET instance_id = ? WHERE instance_id = ?`,
        anchor,
        uuid,
      )
      affected += count
    }
  }

  return affected
}

async function main() {
  const { apply } = parseArgs()
  const instances = await loadInstances()

  if (instances.length === 0) {
    console.log(
      'Nada a fazer: core_thinkerszap_instances está vazia. ' +
        'Nenhuma mensagem referencia uuid de instância.',
    )
    return
  }

  /** Task 1.2 — verificação de colisão, bloqueante. */
  const collisions = findAnchorCollisions(instances)
  if (collisions.size > 0) {
    console.error(
      `\nABORTADO: ${collisions.size} âncora(s) resolvida(s) por mais de uma instância.`,
    )
    for (const [anchor, rows] of collisions) {
      console.error(`  ${anchor} ← ${rows.map(row => row.id).join(', ')}`)
    }
    console.error(
      '\nTraduzir assim colapsaria escopos de idempotência e permitiria mensagem ' +
        'duplicada. Resolva a duplicidade antes de migrar.',
    )
    process.exit(1)
  }

  const translatable: { uuid: string; anchor: string }[] = []
  const withoutAnchor: InstanceRow[] = []

  for (const row of instances) {
    const anchor = resolveAnchor(row)
    if (anchor) translatable.push({ uuid: row.id, anchor })
    else withoutAnchor.push(row)
  }

  const pendingMessages = await countPending(
    'core_thinkerszap_messages',
    translatable.map(pair => pair.uuid),
  )
  const pendingConversations = await countPending(
    'core_thinkerszap_conversations',
    translatable.map(pair => pair.uuid),
  )

  console.log(`Instâncias: ${instances.length}`)
  console.log(`  com âncora resolvida: ${translatable.length}`)
  console.log(`  sem âncora: ${withoutAnchor.length}`)
  console.log(`Mensagens a traduzir: ${pendingMessages}`)
  console.log(`Conversas a traduzir: ${pendingConversations}`)

  /**
   * Instância sem âncora é conector HubMessage sem `channel_id` gravado. As
   * mensagens dela **mantêm o uuid** e ficam órfãs: apagar histórico de cliente
   * para limpar uma coluna seria trocar um problema cosmético por perda de dado.
   */
  for (const row of withoutAnchor) {
    console.warn(
      `[sem âncora] instância ${row.id} (provider ${row.provider ?? 'ZAPI'}) — ` +
        'mensagens mantêm o uuid antigo',
    )
  }

  if (!apply) {
    console.log('\nRelatório apenas. Rode com --apply para escrever.')
    return
  }

  const translatedMessages = await translate(
    'core_thinkerszap_messages',
    translatable,
  )
  const translatedConversations = await translate(
    'core_thinkerszap_conversations',
    translatable,
  )

  console.log(
    `\nTraduzidas: ${translatedMessages} mensagem(ns), ` +
      `${translatedConversations} conversa(s).`,
  )
  console.log(
    'Confirme que nenhuma linha restou com formato de uuid antes de trocar as constraints.',
  )
}

// Instância sem âncora é estado esperado e não vira código de saída diferente de
// zero — o relatório é o resultado. Só colisão aborta.
main()
  .catch(error => {
    console.error('Falha no backfill de instance_id:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
