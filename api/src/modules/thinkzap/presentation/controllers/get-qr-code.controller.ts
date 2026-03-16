import { Controller } from "@/shared/presentation/controller";
import { ZApiClient } from "../../infra/clients/z-api.client";
import { httpResponse } from "@/shared/helpers/http";
import { Request, Response } from "express";
import { GetInstanceRepository } from "../../domain/repositories/get-instance.repository";
import { GetConnectorRepository } from "../../domain/repositories/get-connector.repository";

export class GetQrCodeController extends Controller {

  constructor(
    private readonly zApiClient: ZApiClient,
    private readonly getConnector: GetConnectorRepository,
    private readonly getInstanceRepository: GetInstanceRepository
  ) {
    super();
  }

  async perform(req: Request, res: Response): Promise<httpResponse> {
    const { id } = req.params;

    if (!id) {
      return this.badRequest(new Error('Instance ID is required'));
    }

    const connector = await this.getConnector.get(id as string);
    if (!connector) {
      return this.notFound(new Error('Connector not found'));
    }

    const instance = await this.getInstanceRepository.getInstance(connector.instanceId);
    if (!instance) {
      return this.notFound(new Error('Instance not found'));
    }

    const qrCode = await this.zApiClient.getQRCode(instance.instanceId, instance.zApiToken as string);
    return this.ok(qrCode);
  }
}