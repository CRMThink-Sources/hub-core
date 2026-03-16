import { InstalledApp } from "@/shared/domain/entities/installed-app";
import { CreateInstalledAppRepository } from "@/shared/domain/repositories/instaled-app/create-installed-app.repository";
import { GetInstalledAppRepository } from "@/shared/domain/repositories/instaled-app/get-installed-app.repository";
import { prisma } from "@/config/prisma.js";
import { randomUUID } from "crypto";

export class PrismaInstalledAppRepository implements GetInstalledAppRepository, CreateInstalledAppRepository {

  async getByAppCodeAndDomainId(appCodeId: string, domainId: string): Promise<InstalledApp | null> {
    const installedApp = await prisma.app.findFirst({
      where: { appCodeId, domainId },
    });
    if (!installedApp) return null;
    return installedApp;
  }

  async getById(id: string): Promise<InstalledApp | null> {
    const installedApp = await prisma.app.findUnique({
      where: { id },
    });

    if (!installedApp) return null;

    return installedApp;
  }

  async getByDomainId(domainId: string): Promise<InstalledApp | null> {
    const installedApp = await prisma.app.findFirst({
      where: { domainId },
    });

    if (!installedApp) return null;

    return installedApp;
  }

  async create(installedApp: Omit<InstalledApp, "id">): Promise<InstalledApp> {
    const newInstalledApp = await prisma.app.create({
      data: {
        id: randomUUID(),
        appCodeId: installedApp.appCodeId,
        domainId: installedApp.domainId,
      },
      include: {
        appCode: true,
      }
    });

    return newInstalledApp;
  }
}