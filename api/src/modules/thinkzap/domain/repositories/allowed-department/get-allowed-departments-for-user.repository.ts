import { AllowedDepartment } from '../../entities/allowed-department'

export interface GetAllowedDepartmentsForUserRepository {
  getDepartmentsByAppIdAndIds(
    appId: string,
    bitrixDepartmentIds: string[],
  ): Promise<AllowedDepartment[]>
}
