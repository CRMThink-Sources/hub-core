import { Plan } from '@/modules/application/domain/entities/plan'

export interface PlanRepository {
  getPlan(id: string): Promise<Plan>
  getPlans(): Promise<Plan[]>
}
