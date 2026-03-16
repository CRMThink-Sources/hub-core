import { AvailableApp } from "@/shared/domain/entities/available-app";

export interface GetAvailableAppRepository {
  getAvailableApp(appCode: string): Promise<AvailableApp>;
}