import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { makeBitrixClientByAppId } from '@/shared/main/make-bitrix-client'
import { BitrixDepartmentDirectory } from '../infra/adapters/bitrix-department-directory.adapter'
import { CachedDepartmentDirectory } from '../infra/adapters/cached-department-directory'

/**
 * Instância única por processo: o cache só serve se o gate do widget e a tela de
 * administração usarem o mesmo.
 */
export const departmentDirectory = new CachedDepartmentDirectory(
  new BitrixDepartmentDirectory(
    async installedAppId =>
      (await makeBitrixClientByAppId(installedAppId, 'bitrix')) as BitrixClient,
  ),
)
