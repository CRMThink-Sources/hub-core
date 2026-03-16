

export interface GenerateTokenOutput {
  token: string;
}

export interface GenerateTokenRepository {
  generateToken(input: any): Promise<GenerateTokenOutput>;
}