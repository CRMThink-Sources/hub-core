/** Plano não existe no catálogo. */
export class PlanNotFoundError extends Error {
  constructor(planId: string) {
    super(`Plano "${planId}" não encontrado`)
    this.name = 'PlanNotFoundError'
  }
}
