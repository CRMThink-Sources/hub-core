export interface IBX24MessageEvent {
  event: string;
  event_handler_id: string;
  data: {
    CONNECTOR: string;
    LINE: string;
    MESSAGES: {
      im: {
        chat_id: string;
        message_id: string;
      };
      message: {
        user_id: string;
        text: string;
        files: {
          name: string;
          type: string;
          mime: string;
          link: string;
          downloadLink: string;
          size: string;
          sizef: string;
          width: string;
          height: string;
        }[];
      }
      chat: {
        id: string;
      }
    }[]
  }
  ts: string;
  auth: {
    access_token: string;
    expires: string;
    expires_in: string;
    scope: string;
    domain: string;
    server_endpoint: string;
    status: string;
    client_endpoint: string;
    member_id: string;
    user_id: string;
    application_token: string;
  }
}