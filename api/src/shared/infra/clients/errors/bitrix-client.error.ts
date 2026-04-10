export class BitrixError extends Error {
  response: any
  constructor(message: string) {
    super(message)
    this.name = 'BitrixError'
  }
}
