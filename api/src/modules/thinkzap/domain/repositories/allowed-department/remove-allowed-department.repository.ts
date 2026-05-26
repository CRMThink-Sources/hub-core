export interface RemoveAllowedDepartmentRepository {
  removeDepartment(appId: string, bitrixDepartmentId: string): Promise<void>
}
