import { Instance } from "./instance";

export type Connector = {
  id: string;
  instanceId: string;
  appId: string;
  instance?: Instance;
  createdAt: Date;
  updatedAt: Date;
}