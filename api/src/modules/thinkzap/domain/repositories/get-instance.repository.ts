import { Instance } from "@/modules/thinkzap/domain/entities/instance";

export interface GetInstanceRepository {
  getInstance(instanceId: string): Promise<Instance | null>;
  getInstanceByInstanceId(instanceId: string): Promise<Instance | null>;
  getByDomainIdAndVinculatedChannel(domainId: string, vinculatedChannel: string): Promise<Instance | null>;
}