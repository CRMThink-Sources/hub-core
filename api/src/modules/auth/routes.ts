import { Router } from "express"
import { createInstallController } from "./main/factories/create-install-controller";
import { createLoginController } from "./main/factories/create-login-controller";

export const createAuthRoutes = (): Router => {
  const router = Router();

  router.post("/", createLoginController().handle);
  router.post("/install", createInstallController().handle);

  return router;
}