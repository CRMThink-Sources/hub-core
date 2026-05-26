export interface ExistsAllowedDepartmentRepository {
  existsDepartment(appId: string, bitrixDepartmentId: string): Promise<boolean>
}
