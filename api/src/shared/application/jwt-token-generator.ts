/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  GenerateTokenOutput,
  GenerateTokenRepository,
} from '../data/contracts/generate-token'
import jwt from 'jsonwebtoken'

export class JwtTokenGenerator implements GenerateTokenRepository {
  generateToken(input: any): GenerateTokenOutput {
    const secret = process.env.JWT_SECRET ?? ''
    const token = jwt.sign(input, secret)
    return { token }
  }
}
