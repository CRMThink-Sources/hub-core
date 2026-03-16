import { Request } from "express";
import { httpResponse } from "@/shared/helpers/http";
import { Controller } from "@/shared/presentation/controller";
import { GetAvailableAppRepository } from "@/shared/domain/repositories/get-available-app.repository";
import { GetOrCreateDomain } from "@/shared/application/get-or-create-domain";
import { GetOrCreateInstalledApp } from "@/shared/application/get-or-create-installed-app";
import { GetOrCreateCredential } from "@/shared/application/get-or-create-credential";
import { bitrixInstallBindRegistry } from "@/shared/infra/setup-bitrix-install-binds";
import { BitrixRestClient } from "@/shared/infra/clients/bitrix-rest.client";

export class InstallController extends Controller {
  constructor(
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getOrCreateDomain: GetOrCreateDomain,
    private readonly getOrCreateInstalledApp: GetOrCreateInstalledApp,
    private readonly getOrCreateCredential: GetOrCreateCredential
  ) {
    super();
  }

  async perform(req: Request): Promise<httpResponse> {
    const data = req.body;

    if (!data.domain || !data.member_id || !data.app_code) {
      return this.badRequest(new Error("Invalid request"));
    }

    const availableApp = await this.getAvailableAppRepository.getAvailableApp(data.app_code);

    if (!availableApp) {
      return this.notFound(new Error("Available app not found"));
    }

    const domain = await this.getOrCreateDomain.execute({
      name: data.domain,
      memberId: data.member_id,
    });

    const installedApp = await this.getOrCreateInstalledApp.execute({
      domainId: domain.id,
      appCodeId: availableApp.id,
    });

    await this.getOrCreateCredential.execute({
      appId: installedApp.id,
      clientId: availableApp.code,
      clientSecret: availableApp.secret,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    });

    const bitrixBinds = bitrixInstallBindRegistry.getBindsForApp(data.app_code);

    if (bitrixBinds.length > 0) {
      const bitrixClient = new BitrixRestClient(data.domain, data.access_token);
      for (const bind of bitrixBinds) {
        try {
          await bitrixClient.callMethod(bind.method, bind.params);
        } catch (error: any) {
          console.error(`Error binding ${bind.method} to Bitrix:`, error.message);
        }
      }
    }

    return {
      result: {
        ...domain,
        app: installedApp,
      },
      status: 200,
    };
  }
}