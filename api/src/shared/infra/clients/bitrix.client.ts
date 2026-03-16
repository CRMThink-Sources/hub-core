import { Credential } from "@/shared/domain/entities/credential";
import { BitrixOAuthClient } from "./bitrix-oauth.client";
import axios from "axios";
import { Conversation } from "@/modules/thinkzap/domain/entities/conversation";

export class BitrixClient {
  private readonly bitrixCredential: Credential;
  private readonly domain: string;

  constructor(bitrixCredential: Credential, domain: string) {
    this.bitrixCredential = bitrixCredential;
    this.domain = domain;
  }

  async getClient() {
    return axios.create({
      baseURL: `https://${this.domain}/rest/`,
      params: {
        auth: this.bitrixCredential.accessToken,
      },
    })
  }

  async activateConnector(line: number) {
    const client = await this.getClient();
    console.log("client", client);
    try {
      const response = await client.post('/imconnector.activate', {
        LINE: line,
        CONNECTOR: "hubthink_thinkerszap",
        ACTIVE: 1,
      });

      return response.data;
    } catch (error) {
      console.log("error", error);
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : "Failed to activate connector";
      throw new Error(message);
    }
  }

  async sendMessage(data: ISendMessageData) {
    const client = await this.getClient();
    try {
      const response = await client.post('/imconnector.send.messages', data);
      return response.data;
    } catch (error) {
      console.log("error", error);
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : "Failed to create conversation";
      throw new Error(message);
    }

  }

  async getChat(chatId: string) {
    const client = await this.getClient();
    try {
      const response = await client.get(`/im.dialog.get?DIALOG_ID=${chatId}`);
      return response.data.result;
    } catch (error) {
      console.log("error", error);
      const message =
        axios.isAxiosError(error) && error.response
          ? `Bitrix error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
          : "Failed to get chat";
      throw new Error(message);
    }
  }

  async setMessageDelivered(data: ISetMessageDeliveredData) {
    const client = await this.getClient();
    try {
      const response = await client.post('/imconnector.send.status.delivery', data);
      return response.data;
    } catch (error) {
      console.log("error", error);
    }
  }
}

export interface ISendMessageData {
  CONNECTOR: string;
  LINE: number;
  MESSAGES: {
    user: {
      id: string;
      name: string;
      last_name: string;
      phone: string;
      picture?: {
        url: string;
      }
    };
    message: {
      id: string;
      date: string;
      text: string;
      files?: {
        url: string;
        name: string;
      }[];
    };
    chat: {
      id: string;
      name: string;
    }
  }[]
}

interface ISetMessageDeliveredData {
  CONNECTOR: string;
  LINE: string;
  MESSAGES: {
    im: any;
    message: {
      id: string;
    }
    chat: {
      id: string;
    }
  }[]
}