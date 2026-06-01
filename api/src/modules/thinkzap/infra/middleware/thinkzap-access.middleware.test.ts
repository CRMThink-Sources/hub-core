import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-installed-app.repository',
  () => ({ PrismaInstalledAppRepository: vi.fn() }),
)
vi.mock(
  '../persistence/repositories/prisma-allowed-user.repository',
  () => ({ PrismaAllowedUserRepository: vi.fn() }),
)
vi.mock(
  '../persistence/repositories/prisma-allowed-department.repository',
  () => ({ PrismaAllowedDepartmentRepository: vi.fn() }),
)

import {
  requireThinkzapPermission,
  requireThinkzapWidgetMessaging,
} from './thinkzap-access.middleware'
import type { ThinkzapAccessResult } from '../../application/check-thinkzap-access'

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const accessNoConnectors: ThinkzapAccessResult = {
  canManageAccess: false,
  canAccess: false,
  canAccessFinance: true,
  permissions: {
    connectors: { read: false, create: false, update: false, delete: false },
    finance: { read: true, create: false, update: false, delete: false },
  },
}

describe('requireThinkzapWidgetMessaging', () => {
  it('calls next when thinkzapAccess is set', () => {
    const req = { thinkzapAccess: accessNoConnectors } as Request
    const res = mockRes()
    const next = vi.fn()

    requireThinkzapWidgetMessaging(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when thinkzapAccess is missing', () => {
    const req = {} as Request
    const res = mockRes()
    const next = vi.fn()

    requireThinkzapWidgetMessaging(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'thinkzap_access_denied' })
  })
})

describe('requireThinkzapPermission vs widget guard', () => {
  it('denies connectors.read when user has no connector permissions', () => {
    const req = { thinkzapAccess: accessNoConnectors } as Request
    const res = mockRes()
    const next = vi.fn()

    requireThinkzapPermission('connectors', 'read')(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'thinkzap_permission_denied' })
  })
})
