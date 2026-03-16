import axios, { type AxiosInstance } from "axios";

/**
 * Cliente para chamadas REST do Bitrix24.
 * Usa access_token para autenticação (ex: token do payload de instalação).
 */
export class BitrixRestClient {
  private readonly client: AxiosInstance;

  constructor(domain: string, accessToken: string) {
    this.client = axios.create({
      baseURL: `https://${domain}/rest/`,
      params: { auth: accessToken },
    });
  }

  /**
   * Chama um método da REST API do Bitrix.
   * Ex: callMethod("event.bind", { event: "ONIMCONNECTORMESSAGEADD", ... })
   */
  async callMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
    const response = await this.client.post(`/${method}`, params);
    const data = response.data;
    if (data?.error) {
      throw new Error(`Bitrix ${method}: ${data.error_description ?? data.error}`);
    }
    return data.result ?? data;
  }
}
