import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma.js'

/**
 * Destinatários do aviso de conexão/desconexão, por app. Tabela relacional
 * (`thinkzap_connection_notify_recipients`) — substitui a lista em JSON dentro de
 * `app.option` (`NotifyRecipientsService`), que exigia parse tolerante porque
 * "bugava" com o tempo. Aqui não há JSON pra corromper: cada linha é um usuário.
 */
export class PrismaConnectionNotifyRecipientRepository {
  async listByAppId(appId: string): Promise<number[]> {
    const rows = await prisma.thinkzapConnectionNotifyRecipient.findMany({
      where: { appId },
      select: { bitrixUserId: true },
    })
    return rows.map(row => row.bitrixUserId)
  }

  /**
   * Substitui a lista inteira do app: apaga o que não está em `bitrixUserIds` e insere
   * o que falta. Transação porque um leitor no meio do caminho não pode ver a lista
   * vazia — o mesmo risco que a versão antiga evitava sobrescrevendo o JSON inteiro de
   * uma vez.
   */
  async replaceAll(appId: string, bitrixUserIds: number[]): Promise<number[]> {
    const unique = [...new Set(bitrixUserIds)]

    await prisma.$transaction([
      prisma.thinkzapConnectionNotifyRecipient.deleteMany({
        where: { appId },
      }),
      ...(unique.length > 0
        ? [
            prisma.thinkzapConnectionNotifyRecipient.createMany({
              data: unique.map(bitrixUserId => ({
                id: randomUUID(),
                appId,
                bitrixUserId,
              })),
            }),
          ]
        : []),
    ])

    return unique
  }
}
