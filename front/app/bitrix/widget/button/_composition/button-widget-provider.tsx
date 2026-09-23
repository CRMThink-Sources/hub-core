'use client'

import { BX24Script, useBX24 } from '@/bitrix'
import { getBitrixAppInfoFromUrl } from '@/bitrix'
import { envConfig } from '@/shared/infra/env-config'
import { useSearchParams } from 'next/navigation'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BX24PlacementInfo } from '@/bitrix/types'
import {
  hasUploadAuth,
  resolveBitrixDomain,
  resolveDialogId,
  resolveImbotAuth,
} from '@/app/bitrix/widget/audio/_domain/imbot-context'

// Chama o backend direto — não passa pelo proxy Next em `/api/*`, que na infra
// de prod/staging cai direto no container do backend e nunca chega ao Next.
const SEND_ENDPOINT = `${envConfig.apiUrl.replace(/\/$/, '')}/open-channel-button/send`

const THINKZAP_APP_CODE = envConfig.appCodes.thinkzap || 'crmthink.thinkzap'

export type ButtonWidgetContextValue = {
  mounted: boolean
  bx24Ready: boolean
  dialogId: string | null
  domain: string | null
  imbotAuth: ReturnType<typeof resolveImbotAuth>
  accessToken: string | null
  canSend: boolean
  thinkzapAppCode: string
  sendEndpoint: string
}

const PLACEHOLDER_CONTEXT: ButtonWidgetContextValue = {
  mounted: false,
  bx24Ready: false,
  dialogId: null,
  domain: null,
  imbotAuth: null,
  accessToken: null,
  canSend: false,
  thinkzapAppCode: THINKZAP_APP_CODE,
  sendEndpoint: SEND_ENDPOINT,
}

const ButtonWidgetContext = createContext<ButtonWidgetContextValue | null>(null)

export function useButtonWidgetContext(): ButtonWidgetContextValue {
  const value = useContext(ButtonWidgetContext)
  if (!value) {
    throw new Error(
      'useButtonWidgetContext must be used within ButtonWidgetProvider',
    )
  }
  return value
}

type ButtonWidgetProviderProps = {
  children: ReactNode
  scriptLoaded: boolean
}

export function ButtonWidgetProvider({
  children,
  scriptLoaded,
}: ButtonWidgetProviderProps) {
  const searchParams = useSearchParams()
  const { ready: bx24Ready, getAuth } = useBX24(scriptLoaded)
  const [mounted, setMounted] = useState(false)
  const [placementInfo, setPlacementInfo] = useState<BX24PlacementInfo | null>(
    null,
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!bx24Ready || typeof window === 'undefined') return

    const placement = window.BX24?.placement?.info
    if (!placement) return

    try {
      setPlacementInfo(placement())
    } catch {
      setPlacementInfo(null)
    }
  }, [bx24Ready])

  const value = useMemo<ButtonWidgetContextValue>(() => {
    if (!mounted) {
      return PLACEHOLDER_CONTEXT
    }

    const appInfo = getBitrixAppInfoFromUrl()
    const urlParams = appInfo.urlParams ?? {}
    const auth = bx24Ready && getAuth ? getAuth() : false
    const accessToken =
      auth && typeof auth === 'object' ? auth.access_token : null
    const imbotAuth = resolveImbotAuth(urlParams)

    const domain = resolveBitrixDomain(
      searchParams,
      appInfo.domain,
      auth && typeof auth === 'object' ? auth.domain : null,
    )

    const dialogId = resolveDialogId(
      searchParams,
      urlParams,
      undefined,
      placementInfo,
    )

    return {
      mounted: true,
      bx24Ready,
      dialogId,
      domain,
      imbotAuth,
      accessToken,
      canSend: hasUploadAuth(imbotAuth, accessToken),
      thinkzapAppCode: THINKZAP_APP_CODE,
      sendEndpoint: SEND_ENDPOINT,
    }
  }, [mounted, searchParams, bx24Ready, getAuth, placementInfo])

  return (
    <ButtonWidgetContext.Provider value={value}>
      {children}
    </ButtonWidgetContext.Provider>
  )
}

type ButtonWidgetRootProps = {
  children: ReactNode
}

export function ButtonWidgetRoot({ children }: ButtonWidgetRootProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false)

  return (
    <>
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      <ButtonWidgetProvider scriptLoaded={scriptLoaded}>
        {children}
      </ButtonWidgetProvider>
    </>
  )
}
