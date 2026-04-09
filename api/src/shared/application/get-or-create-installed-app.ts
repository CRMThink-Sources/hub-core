import { InstalledApp } from '../domain/entities/installed-app'
import { CreateInstalledAppRepository } from '../domain/repositories/instaled-app/create-installed-app.repository'
import { GetInstalledAppRepository } from '../domain/repositories/instaled-app/get-installed-app.repository'

export type GetOrCreateInstalledAppInput = {
  domainId: string
  appCodeId: string
}

export class GetOrCreateInstalledApp {
  constructor(
    private readonly getInstalledAppRepository: GetInstalledAppRepository &
      CreateInstalledAppRepository,
  ) {}

  async execute(input: GetOrCreateInstalledAppInput): Promise<InstalledApp> {
    const existing =
      await this.getInstalledAppRepository.getByAppCodeAndDomainId(
        input.appCodeId,
        input.domainId,
      )

    if (existing) {
      return existing
    }

    return this.getInstalledAppRepository.create({
      domainId: input.domainId,
      appCodeId: input.appCodeId,
      status: 'ACTIVE',
      installedAt: new Date(),
      updatedAt: new Date(),
    })
  }
}
