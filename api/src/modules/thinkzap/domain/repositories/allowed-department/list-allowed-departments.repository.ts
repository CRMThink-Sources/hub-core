import { AllowedDepartment } from '../../entities/allowed-department'

export interface ListAllowedDepartmentsRepository {
  listDepartmentsByAppId(appId: string): Promise<AllowedDepartment[]>
}
