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
} from '../_domain/imbot-context'

const UPLOAD_ENDPOINT = '/api/audio/upload'

const THINKZAP_APP_CODE = envConfig.appCodes.thinkzap || 'crmthink.thinkzap'

export type AudioWidgetContextValue = {
  mounted: boolean
  bx24Ready: boolean
  dialogId: string | null
  domain: string | null
  imbotAuth: ReturnType<typeof resolveImbotAuth>
  accessToken: string | null
  canUpload: boolean
  thinkzapAppCode: string
  uploadEndpoint: string
}

const PLACEHOLDER_CONTEXT: AudioWidgetContextValue = {
  mounted: false,
  bx24Ready: false,
  dialogId: null,
  domain: null,
  imbotAuth: null,
  accessToken: null,
  canUpload: false,
  thinkzapAppCode: THINKZAP_APP_CODE,
  uploadEndpoint: UPLOAD_ENDPOINT,
}

const AudioWidgetContext = createContext<AudioWidgetContextValue | null>(null)

export function useAudioWidgetContext(): AudioWidgetContextValue {
  const value = useContext(AudioWidgetContext)
  if (!value) {
    throw new Error(
      'useAudioWidgetContext must be used within AudioWidgetProvider',
    )
  }
  return value
}

type AudioWidgetProviderProps = {
  children: ReactNode
  scriptLoaded: boolean
}

export function AudioWidgetProvider({
  children,
  scriptLoaded,
}: AudioWidgetProviderProps) {
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

  const value = useMemo<AudioWidgetContextValue>(() => {
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
      canUpload: hasUploadAuth(imbotAuth, accessToken),
      thinkzapAppCode: THINKZAP_APP_CODE,
      uploadEndpoint: UPLOAD_ENDPOINT,
    }
  }, [mounted, searchParams, bx24Ready, getAuth, placementInfo])

  return (
    <AudioWidgetContext.Provider value={value}>
      {children}
    </AudioWidgetContext.Provider>
  )
}

type AudioWidgetRootProps = {
  children: ReactNode
}

export function AudioWidgetRoot({ children }: AudioWidgetRootProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false)

  return (
    <>
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      <AudioWidgetProvider scriptLoaded={scriptLoaded}>
        {children}
      </AudioWidgetProvider>
    </>
  )
}
