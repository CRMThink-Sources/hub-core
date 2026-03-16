"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BX24Script,
  useBX24,
  fetchAppInfoFromCallMethod,
  getBitrixAppInfoFromUrl,
} from "@/bitrix";
import {
  getAppRedirectUrl
} from "@/app/config/app-redirects";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const AUTH_TOKEN_KEY = "hubthink_auth_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const { ready: bx24Ready } = useBX24(scriptLoaded);
  const [authRedirecting, setAuthRedirecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  // 2) Se estamos no Bitrix (DOMAIN na URL), autenticar e redirecionar conforme appCode
  useEffect(() => {
    if (!scriptLoaded || !bx24Ready || typeof window === "undefined" || !API_URL) return;

    const urlInfo = getBitrixAppInfoFromUrl();
    if (!urlInfo.domain) return;

    let cancelled = false;

    async function runAuthAndRedirect() {
      setAuthRedirecting(true);
      setAuthError(null);
      try {
        const appInfoData = await fetchAppInfoFromCallMethod();
        const appCode = appInfoData?.CODE ?? "";
        if (!appCode) {
          setAuthError("Não foi possível obter o código do app (app.info).");
          setAuthRedirecting(false);
          return;
        }

        const response = await axios.post(`${API_URL}/auth`, {
          domain: urlInfo.domain,
          member_id: urlInfo.member_id ?? "",
          app_code: appCode,
        });
        console.log(response.data.result);
        const authToken = response.data?.result?.token;
        sessionStorage.setItem(AUTH_TOKEN_KEY, authToken);
        // return;
        const errorMessage = response.data?.error?.message;
        if (!response.data || !authToken) {
          setAuthError(errorMessage ?? "Falha ao autenticar no backend.");
          setAuthRedirecting(false);
          return;
        }

        if (cancelled) return;

        const baseRedirectUrl = getAppRedirectUrl(appCode);
        if (baseRedirectUrl) {
          router.push(baseRedirectUrl);
        } else {
          setAuthError("Aplicação não configurada para o app: " + appCode);
          setAuthRedirecting(false);
          return;
        }

      } catch (e) {
        if (!cancelled) {
          setAuthError(e instanceof Error ? e.message : "Erro ao autenticar.");
        }
      } finally {
        if (!cancelled) setAuthRedirecting(false);
      }
    }

    runAuthAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [scriptLoaded, bx24Ready]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 sm:p-8">
      <BX24Script onLoad={() => setScriptLoaded(true)} />
      {authRedirecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-600">Autenticando e redirecionando...</p>
          </div>
        </div>
      )}
      {authError && (
        <div className="mx-auto max-w-4xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-medium">Erro na autenticação</p>
          <p className="mt-1 text-sm">{authError}</p>
        </div>
      )}
    </div>
  );
}
