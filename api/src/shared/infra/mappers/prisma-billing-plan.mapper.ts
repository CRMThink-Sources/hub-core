import { PrismaBillingPlan } from "@repo/db";
import { BillingPlan } from "@/shared/domain/entities/billing-plan";

export const toBillingPlan = (raw: PrismaBillingPlan): BillingPlan => {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type as any,
    description: raw.description ?? "Sem descrição",
    credits: raw.credits ?? 0,
    bonusCredits: raw.bonusCredits ?? 0,
    price: raw.price.toNumber(),
    isRecurring: raw.isRecurring,
    stripePriceId: raw.stripePriceId ?? undefined,
    active: raw.active,
    sort: raw.sortOrder ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}