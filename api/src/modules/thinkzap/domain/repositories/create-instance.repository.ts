import { Instance } from "../entities/instance";

export interface CreateInstanceRepository {
  create(instance: Omit<Instance, "id" | "createdAt" | "updatedAt">): Promise<Instance>;
}