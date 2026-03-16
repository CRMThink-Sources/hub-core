export type BillingPlan = {
  id: number;
  type: PlanType;
  name: string;
  description: string;
  credits?: number;
  bonusCredits?: number;
  price: number;
  isRecurring: boolean;
  stripePriceId?: string;
  active: boolean;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
};

enum PlanType {
  CREDITS = "CREDITS",
  SUBSCRIPTION = "SUBSCRIPTION",
}