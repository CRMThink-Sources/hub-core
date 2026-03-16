interface BitrixServiceParams {
  domain: string;
  accesssToken: string;
  refreshToken: string;
  expiresIn: number;
  clientId: string;
  clientSecret: string;
}

export class BitrixService {
  private readonly domain: string;
  private readonly accesssToken: string;
  private readonly refreshToken: string;
  private readonly expiresIn: number;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(params: BitrixServiceParams) {
    this.domain = params.domain;
    this.accesssToken = params.accesssToken;
    this.refreshToken = params.refreshToken;
    this.expiresIn = params.expiresIn;
    this.clientId = params.clientId;
    this.clientSecret = params.clientSecret;
  }
}