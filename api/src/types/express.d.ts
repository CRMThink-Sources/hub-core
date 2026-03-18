declare global {
  namespace Express {
    interface Request {
      appId?: string
      domainId?: string
    }
  }
}

export {}
