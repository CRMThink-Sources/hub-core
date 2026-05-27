export const B24JS_SDK_URL =
  'https://unpkg.com/@bitrix24/b24jssdk@latest/dist/umd/index.min.js'

export type B24FrameCallMethodResponse = {
  getData: () => {
    result?: unknown
    error?: string
    error_description?: string
  }
}

export type B24FrameClient = {
  callMethod: (
    method: string,
    params: Record<string, unknown>,
  ) => Promise<B24FrameCallMethodResponse>
}

declare global {
  interface Window {
    B24Js?: {
      initializeB24Frame: () => Promise<B24FrameClient>
    }
  }
}
