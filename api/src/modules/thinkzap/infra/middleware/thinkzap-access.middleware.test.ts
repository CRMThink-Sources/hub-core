import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

vi.mock(
  '@/shared/infra/persistence/repositories/prisma-installed-app.repository',
  () => ({ PrismaInstalledAppRepository: vi.fn() }),
)
vi.mock('../persistence/repositories/prisma-allowed-user.repository', () => ({
  PrismaAllowedUserRepository: vi.fn(),
}))
vi.mock(
  '../persistence/repositories/prisma-allowed-department.repository',
  () => ({ PrismaAllowedDepartmentRepository: vi.fn() }),
)

import { requireThinkzapPermission } from './thinkzap-access.middleware'
import type { ThinkzapAccessResult } from '../../application/check-thinkzap-access'

function mockRes() {
  const status = vi.fn().mockReturnThis()
  const json = vi.fn().mockReturnThis()
  const res = { status, json } as unknown as Response
  return { res, status, json }
}

const accessNoConnectors: ThinkzapAccessResult = {
  canManageAccess: false,
  canAccess: false,
  canAccessFinance: true,
  canAccessThinkbot: true,
  permissions: {
    connectors: { read: false, create: false, update: false, delete: false },
    finance: { read: true, create: false, update: false, delete: false },
    thinkbot: {
      read: true,
      create: true,
      update: true,
      delete: false,
      publish: false,
    },
  },
}

describe('requireThinkzapPermission', () => {
  it('denies connectors.read when user has no connector permissions', () => {
    const req = { thinkzapAccess: accessNoConnectors } as Request
    const { res, status, json } = mockRes()
    const next = vi.fn()

    requireThinkzapPermission('connectors', 'read')(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith({
      error: 'thinkzap_permission_denied',
    })
  })

  it('allows finance.read when user has finance read permission', () => {
    const req = { thinkzapAccess: accessNoConnectors } as Request
    const { res, status } = mockRes()
    const next = vi.fn()

    requireThinkzapPermission('finance', 'read')(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(status).not.toHaveBeenCalled()
  })

  it('denies thinkbot.publish to who can only edit flows', () => {
    const req = { thinkzapAccess: accessNoConnectors } as Request
    const { res, status } = mockRes()
    const next = vi.fn()

    requireThinkzapPermission('thinkbot', 'update')(req, res, next)
    requireThinkzapPermission('thinkbot', 'publish')(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(status).toHaveBeenCalledWith(403)
  })
})
