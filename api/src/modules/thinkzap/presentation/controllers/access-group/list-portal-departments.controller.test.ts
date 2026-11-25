import type { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import type { DepartmentDirectory } from '@/modules/thinkzap/domain/ports/department-directory.port'
import { requireThinkzapAdmin } from '@/modules/thinkzap/infra/middleware/thinkzap-access.middleware'
import { ListPortalDepartmentsController } from './list-portal-departments.controller'

const res = {} as Response
const req = { thinkzapInstalledAppId: 'app-1' } as Request

describe('ListPortalDepartmentsController', () => {
  it('devolve os departamentos da instalação', async () => {
    const departments = [{ id: '1', name: 'Empresa', parentId: null }]
    const list = vi.fn<DepartmentDirectory['list']>(() =>
      Promise.resolve(departments),
    )

    const out = await new ListPortalDepartmentsController({ list }).perform(
      req,
      res,
    )

    expect(list).toHaveBeenCalledWith('app-1')
    expect(out).toEqual({ status: 200, result: { departments } })
  })

  it('portal que não responde vira 503 com mensagem em português', async () => {
    const list = vi.fn<DepartmentDirectory['list']>(() =>
      Promise.reject(new Error('insufficient_scope')),
    )

    const out = await new ListPortalDepartmentsController({ list }).perform(
      req,
      res,
    )

    expect(out.status).toBe(503)
    expect((out.result as { error: string }).error).toContain(
      'Não foi possível verificar os departamentos',
    )
  })

  it('sem contexto de instalação responde 400', async () => {
    const list = vi.fn<DepartmentDirectory['list']>()

    const out = await new ListPortalDepartmentsController({ list }).perform(
      {} as Request,
      res,
    )

    expect(out.status).toBe(400)
    expect(list).not.toHaveBeenCalled()
  })

  it('quem não administra o ThinkZap é recusado pelo guard da rota', () => {
    const status = vi.fn(() => ({ json: vi.fn() }))
    const next = vi.fn()

    requireThinkzapAdmin(
      { thinkzapAccess: { canManageAccess: false } } as unknown as Request,
      { status } as unknown as Response,
      next as unknown as NextFunction,
    )

    expect(status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
