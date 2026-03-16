import { Credential } from "../../entities/credential";

export interface CreateCredentialRepository {
  create(credential: Omit<Credential, "id" | "createdAt" | "updatedAt">): Promise<Credential>;
}