import { AllowedDepartment } from '../../entities/allowed-department'
import { ThinkzapUserPermissions } from '../../thinkzap-permissions'

export interface AddAllowedDepartmentRepository {
  addDepartment(input: {
    appId: string
    bitrixDepartmentId: string
    displayName?: string | null
    permissions?: ThinkzapUserPermissions
  }): Promise<AllowedDepartment>
}
