import { Spa } from '@/shared/domain/entities/spa'
import { CreateSpaRepository } from '@/shared/domain/repositories/spa/create-spa.repository'
import { GetSpaRepository } from '@/shared/domain/repositories/spa/get-spa.repository'
import { UpdateSpaRepository } from '@/shared/domain/repositories/spa/update-spa.repository'

export type GetOrCreateSpaInput = {
  appId: string
  domain: string
  memberId: string
  name: string
  email: string
  phone: string
  company: string
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
      return this.spaRepository.create({
        appId: input.appId,
        domain: input.domain,
        memberId: input.memberId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
      })
    }

    return this.spaRepository.update({
      appId: input.appId,
      domain: input.domain,
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
    })
  }
}
