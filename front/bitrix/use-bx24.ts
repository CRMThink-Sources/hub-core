"use client";

import { useEffect, useState } from "react";
import { BX24_READY_TIMEOUT_MS } from "./constants";
import { buildInstallPayload, fetchAppInfoFromCallMethod } from "./app-info";
import type { BX24Auth } from "./types";
import type { BitrixInstallPayload } from "./types";

export interface UseBX24Result {
  scriptLoaded: boolean;
  ready: boolean;
  error: string | null;
  /** Chama BX24.installFinish(). Deve ser usado após configurar o app. */
  finishInstall: () => void;
  /** Retorno do BX24.getAuth() se disponível (após ready). */
  getAuth: (() => BX24Auth | false) | undefined;
  /**
   * Monta o payload (auth + app.info via callMethod + email) para enviar à sua API antes de installFinish.
   * Retorna null se BX24 não estiver ready ou getAuth() falhar. Rejeita se callMethod("app.info") falhar.
   */
  getInstallPayload: (email?: string) => Promise<BitrixInstallPayload | null>;
}

/**
 * Hook para usar a API BX24 do Bitrix24 na página de instalação.
 * Recebe scriptLoaded (ex.: do onLoad do BX24Script) e chama BX24.init().
 * Expõe ready, error e finishInstall(). Só funciona dentro do iframe do app no Bitrix24.
 */
export function useBX24(scriptLoaded: boolean): UseBX24Result {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scriptLoaded || typeof window === "undefined") return;

    const BX24 = window.BX24;
    if (!BX24) {
      const timeoutId = setTimeout(() => {
        if (!window.BX24) {
          setError("Esta página deve ser aberta dentro do Bitrix24.");
        }
      }, BX24_READY_TIMEOUT_MS);
      return () => clearTimeout(timeoutId);
    }

    BX24.init(() => setReady(true));
  }, [scriptLoaded]);

  const finishInstall = () => {
    const BX24 = window.BX24;
    if (!BX24)
      throw new Error("BX24 não disponível. Abra esta página no Bitrix24.");
    BX24.installFinish();
  };

  const getAuth =
    ready && window.BX24?.getAuth ? () => window.BX24!.getAuth!() : undefined;

  const getInstallPayload = async (
    email?: string
  ): Promise<BitrixInstallPayload | null> => {
    if (!ready || !getAuth) return null;
    const auth = getAuth();
    if (!auth) return null;
    const appInfoData = await fetchAppInfoFromCallMethod();
    return buildInstallPayload(auth, { appInfoData, email });
  };

  return {
    scriptLoaded,
    ready,
    error,
    finishInstall,
    getAuth,
    getInstallPayload,
  };
}

export type { UseBX24Result as BX24HookResult };
