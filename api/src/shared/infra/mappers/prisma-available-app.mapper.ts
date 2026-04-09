import {
  AppCode as PrismaAppCode,
  BillingPlan as PrismaBillingPlan,
} from '../../../../prisma/generated/prisma/client'
import { AvailableApp } from '@/shared/domain/entities/available-app'
import { toBillingPlan } from './prisma-billing-plan.mapper'
import { BillingPlan } from '@/shared/domain/entities/billing-plan'

export const toAvailableApp = (
  raw: PrismaAppCode & { plans?: PrismaBillingPlan[] },
): AvailableApp & { plans?: BillingPlan[] } => {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name ?? 'Sem nome',
    secret: raw.secret,
    description: raw.description ?? 'Sem descrição',
    plans: raw.plans?.map(toBillingPlan) ?? [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
}
