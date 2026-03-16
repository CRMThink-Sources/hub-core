import { GenerateTokenOutput, GenerateTokenRepository } from "../data/contracts/generate-token";
import jwt from "jsonwebtoken";

export class JwtTokenGenerator implements GenerateTokenRepository {
  async generateToken(input: any): Promise<GenerateTokenOutput> {
    const secret = process.env.JWT_SECRET ?? "";
    const token = jwt.sign(input, secret);
    return { token };
  }
}