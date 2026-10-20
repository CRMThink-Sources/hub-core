type IBX24Auth = {
  access_token: string
  expires: string
  expires_in: string
  scope: string
  domain: string
  server_endpoint: string
  status: string
  client_endpoint: string
  member_id: string
  user_id: string
  /** Opcional pela doc do evento: os tokens nem sempre vêm. */
  refresh_token?: string
  application_token: string
}

export interface IBX24MessageEvent {
  event: string
  event_handler_id: string
  data: {
    CONNECTOR: string
    LINE: string
    MESSAGES: {
      im: {
        chat_id: string
        message_id: string
      }
      message: {
        user_id: string
        text: string
        files?: {
          name: string
          type: string
          mime: string
          link: string
          downloadLink: string
          size: string
          sizef: string
          width: number
          height: number
        }[]
      }
      chat: {
        id: string
      }
    }[]
  }
  ts: string
  auth: IBX24Auth
}
