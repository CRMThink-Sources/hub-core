import { randomUUID } from 'node:crypto'
import { prisma } from '@/config/prisma'
import type {
  ContactIdentityRecord,
  ContactIdentityRepository,
} from '@/modules/thinkzap/domain/repositories/contact-identity.repository'

type Row = {
  instanceId: string
  lid: string
  phone: string | null
  legacyPhoneIdentity: string | null
}

function toRecord(row: Row): ContactIdentityRecord {
  return {
    instanceId: row.instanceId,
    lid: row.lid,
    phone: row.phone,
    legacyPhoneIdentity: row.legacyPhoneIdentity,
  }
}

export class PrismaContactIdentityRepository implements ContactIdentityRepository {
  async findByLid(
    instanceId: string,
    lid: string,
  ): Promise<ContactIdentityRecord | null> {
    const row = await prisma.thinkzapContactIdentity.findUnique({
      where: { uq_identity_instance_lid: { instanceId, lid } },
    })
    return row ? toRecord(row) : null
  }

  async findByPhone(
    instanceId: string,
    phone: string,
  ): Promise<ContactIdentityRecord | null> {
    const row = await prisma.thinkzapContactIdentity.findUnique({
      where: { uq_identity_instance_phone: { instanceId, phone } },
    })
    return row ? toRecord(row) : null
  }

  /**
   * `upsert` pela chave `(instanceId, lid)`, que é a identidade — não pelo telefone.
   *
   * O `update` omite `phone` quando o chamador não trouxe um. Sem essa condição, um
   * evento lid-only chegando depois de um evento com número gravaria `null` por cima e
   * o mapa esqueceria o telefone que já sabia — justamente o que ele existe para
   * lembrar, porque a direção inversa não pode ser recuperada.
   *
   * `legacyPhoneIdentity` não aparece nem no `create` nem no `update`: é coluna do
   * backfill. Row criada aqui nasce sem identidade legada e nunca a ganha.
   */
  async upsertPair(input: {
    instanceId: string
    lid: string
    phone?: string | null
  }): Promise<void> {
    const phone = input.phone ?? null

    await prisma.thinkzapContactIdentity.upsert({
      where: {
        uq_identity_instance_lid: {
          instanceId: input.instanceId,
          lid: input.lid,
        },
      },
      create: {
        id: randomUUID(),
        instanceId: input.instanceId,
        lid: input.lid,
        phone,
      },
      update: phone ? { phone } : {},
    })
  }
}
