import { setLogContext } from '@/shared/infra/log-context'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'

// Resolve o domínio do portal a partir do appId (installedApp → domain) e injeta
// no contexto de log. Best-effort: log sem domínio é melhor que quebrar o fluxo.
export async function setTenantLogContext(appId: string): Promise<void> {
  setLogContext({ appId })
  try {
    const app = await new PrismaInstalledAppRepository().getById(appId)
    if (!app) return
    const domain = await new PrismaDomainRepository().getDomainById(app.domainId)
    if (domain) setLogContext({ domain: domain.name })
  } catch {
    // ignora — segue sem o domínio
  }
}
