import { Request } from 'express'

export function getGroupIdParam(req: Request): string | null {
  const id = req.params.groupId
  if (typeof id === 'string' && id.length > 0) return id
  if (Array.isArray(id) && typeof id[0] === 'string' && id[0].length > 0) {
    return id[0]
  }
  return null
}
