'use client'

import {
  BX24Script,
  fetchAppInfoFromCallMethod,
  getBitrixAppInfoFromUrl,
} from '@/bitrix'
import { SessionProvider } from '@/providers/session-provider'
import { envConfig } from '@/shared/infra/env-config'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { ConversationView } from '../../layouts/conversation-view'
import { getAppRedirectUrl } from '@/app/config/app-redirects'

export default function ConversationsPage() {
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (!scriptLoaded) return

    const urlInfo = getBitrixAppInfoFromUrl()
    if (!urlInfo.domain) return

    const fetch = async () => {
      const appInfoData = await fetchAppInfoFromCallMethod()
      const appCode = appInfoData?.CODE ?? ''

      const response = await axios.post(`${envConfig.apiUrl}/auth`, {
        domain: urlInfo.domain,
        member_id: urlInfo.member_id ?? '',
        app_code: appCode,
      })
      console.log('response:', response.data)
      const dataRedirect = getAppRedirectUrl(appCode)
      if (!dataRedirect) {
        return
      }
      const authToken = response.data?.result?.token
      sessionStorage.setItem(dataRedirect.storageAuthTokenKey, authToken)
      setIsAuthenticated(true)
    }

    void fetch()

    window.BX24?.fitWindow?.(() => {
      window.BX24?.resizeWindow?.(600, 800)
    })
  }, [scriptLoaded])

  return (
    <div>
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      {isAuthenticated && (
        <SessionProvider appCode="crmthink.thinkzap">
          <ConversationView />
        </SessionProvider>
      )}
    </div>
  )
}
