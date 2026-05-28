export {
  buildInstallPayload,
  fetchAppInfoFromCallMethod,
  fetchCurrentUserFromCallMethod,
  getBitrixAppInfoFromUrl,
  type BitrixCurrentUserResult,
} from './app-info'
export {
  authenticateBitrixWithBackend,
  type BitrixBackendAuthResult,
} from './authenticate-with-backend'
export { BX24Script } from './bx24-script'
export {
  BITRIX_EULA_URL,
  BITRIX_MARKET_TERMS_URL,
  BITRIX_PRIVACY_POLICY_URL,
  BX24_SCRIPT_URL,
  BX24_READY_TIMEOUT_MS,
} from './constants'
export type {
  BX24Api,
  BX24Auth,
  BX24CallMethodResult,
  BX24PlacementInfo,
  BX24State,
  BitrixAppInfo,
  BitrixAppInfoResult,
  BitrixInstallPayload,
  InstallStatus,
} from './types'
export { useBX24 } from './use-bx24'
export type { UseBX24Result } from './use-bx24'
export { isBitrixAdmin } from './is-bitrix-admin'
export {
  searchBitrixUsers,
  formatBitrixUserName,
  type BitrixUserSearchHit,
} from './user-search'
export {
  searchBitrixDepartments,
  formatBitrixDepartmentName,
  type BitrixDepartmentHit,
} from './department-search'
