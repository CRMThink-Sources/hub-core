import { Request, Response } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { GetDashboardSummary } from '../../application/get-dashboard-summary'

export class GetDashboardSummaryController extends Controller {
  constructor(private readonly getDashboardSummary: GetDashboardSummary) {
    super()
  }

  async perform(_req: Request, _res: Response): Promise<httpResponse> {
    const summary = await this.getDashboardSummary.execute()
    return this.ok(summary)
  }
}
