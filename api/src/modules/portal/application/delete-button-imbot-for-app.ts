import { deleteImbotButtonApp } from '@/modules/thinkzap/application/delete-imbot-button-app'
import type { DeleteImbotButtonAppResult } from '@/modules/thinkzap/application/delete-imbot-button-app'
import { resolveBitrixClientForApp } from './resolve-bitrix-client-for-app'

export type DeleteButtonImbotForAppOutput = {
  result: DeleteImbotButtonAppResult
}

export async function deleteButtonImbotForApp(
  appId: string,
): Promise<DeleteButtonImbotForAppOutput> {
  const { client } = await resolveBitrixClientForApp(appId)
  const result = await deleteImbotButtonApp(client)

  return { result }
}
