import { GetAllowedUserRepository } from '@/modules/thinkzap/domain/repositories/allowed-user/get-allowed-user.repository'
import { GetBitrixUserDisplayNamePort } from '@/modules/thinkzap/domain/ports/get-bitrix-user-display-name.port'

export async function resolveBitrixUserDisplayName(params: {
  userId: string
  appId: string
  getBitrixUserDisplayName: GetBitrixUserDisplayNamePort
  getAllowedUser?: GetAllowedUserRepository
}): Promise<string | null> {
  const { userId, appId, getBitrixUserDisplayName, getAllowedUser } = params

  if (!userId.trim()) {
    return null
  }

  const displayNameFromBitrix =
    await getBitrixUserDisplayName.getDisplayName(userId)
  if (displayNameFromBitrix) {
    return displayNameFromBitrix
  }

  if (!getAllowedUser) {
    return null
  }

  const allowedUser = await getAllowedUser.getByAppIdAndBitrixUserId(
    appId,
    userId,
  )
  return allowedUser?.displayName?.trim() || null
}
