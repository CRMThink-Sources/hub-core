import { Spa } from '@/shared/domain/entities/spa'
import { CreateSpaRepository } from '@/shared/domain/repositories/spa/create-spa.repository'
import { GetSpaRepository } from '@/shared/domain/repositories/spa/get-spa.repository'
import { UpdateSpaRepository } from '@/shared/domain/repositories/spa/update-spa.repository'

/**
 * `name`, `phone` e `company` são opcionais porque a instalação **não tem** esses
 * dados: eles são capturados na ativação do trial. Chamador sem o dado omite o
 * campo, em vez de mandar `''` — que num `update` significaria apagar o que já
 * está lá.
 */
export type GetOrCreateSpaInput = {
  appId: string
  domain: string
  memberId: string
  email: string
  name?: string
  phone?: string
  company?: string
}

export class GetOrCreateSpa {
  constructor(
    private readonly spaRepository: CreateSpaRepository &
      GetSpaRepository &
      UpdateSpaRepository,
  ) {}

  async execute(input: GetOrCreateSpaInput): Promise<Spa> {
    const existing = await this.spaRepository.get({
      appId: input.appId,
      domain: input.domain,
    })

    if (!existing) {
      /**
       * A criação precisa dos três como `string`: o item nasce com eles vazios, e
       * é a ativação do trial que os preenche.
       */
      return this.spaRepository.create({
        appId: input.appId,
        domain: input.domain,
        memberId: input.memberId,
        email: input.email,
        name: input.name ?? '',
        phone: input.phone ?? '',
        company: input.company ?? '',
      })
    }

    return this.spaRepository.update({
      appId: input.appId,
      domain: input.domain,
      email: input.email,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.company !== undefined && { company: input.company }),
    })
  }
}
