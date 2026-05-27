'use client'

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
import {
  resolveBitrixDomain,
  resolveDialogId,
  resolveImbotAuth,
} from '../_domain/imbot-context'

const UPLOAD_ENDPOINT = '/api/audio/upload'

const THINKZAP_APP_CODE = envConfig.appCodes.thinkzap || 'crmthink.thinkzap'

export type AudioWidgetContextValue = {
  mounted: boolean
  dialogId: string | null
  domain: string | null
  imbotAuth: ReturnType<typeof resolveImbotAuth>
  thinkzapAppCode: string
  uploadEndpoint: string
}

const PLACEHOLDER_CONTEXT: AudioWidgetContextValue = {
  mounted: false,
  dialogId: null,
  domain: null,
  imbotAuth: null,
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
}

export function AudioWidgetProvider({ children }: AudioWidgetProviderProps) {
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const value = useMemo<AudioWidgetContextValue>(() => {
    if (!mounted) {
      return PLACEHOLDER_CONTEXT
    }

    const appInfo = getBitrixAppInfoFromUrl()
    const urlParams = appInfo.urlParams ?? {}

    return {
      mounted: true,
      dialogId: resolveDialogId(searchParams, urlParams),
      domain: resolveBitrixDomain(searchParams, appInfo.domain),
      imbotAuth: resolveImbotAuth(urlParams),
      thinkzapAppCode: THINKZAP_APP_CODE,
      uploadEndpoint: UPLOAD_ENDPOINT,
    }
  }, [mounted, searchParams])

  return (
    <AudioWidgetContext.Provider value={value}>
      {children}
    </AudioWidgetContext.Provider>
  )
}
