import { Plan } from '@/modules/payments/domain/entities/plan'

export interface PlanRepository {
  getPlan(id: string): Promise<Plan>
  getPlans(): Promise<Plan[]>
}
