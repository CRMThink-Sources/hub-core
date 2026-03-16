import { Request } from "express";
import { httpResponse } from "@/shared/helpers/http";
import { Controller } from "@/shared/presentation/controller";
import { GetAvailableAppRepository } from "@/shared/domain/repositories/get-available-app.repository";
import { GetOrCreateDomain } from "@/shared/application/get-or-create-domain";
import { GenerateTokenRepository } from "@/shared/data/contracts/generate-token";

export class LoginController extends Controller {
  constructor(
    private readonly getAvailableAppRepository: GetAvailableAppRepository,
    private readonly getOrCreateDomain: GetOrCreateDomain,
    private readonly generateToken: GenerateTokenRepository,
  ) {
    super();
  }

  async perform(req: Request): Promise<httpResponse> {
    const data = req.body;

    if (!data.domain || !data.app_code) {
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

    const { token } = await this.generateToken.generateToken({
      domainId: domain.id,
      appCodeId: availableApp.id,
    });

    return {
      result: {
        token
      },
      status: 201,
    };
  }
}