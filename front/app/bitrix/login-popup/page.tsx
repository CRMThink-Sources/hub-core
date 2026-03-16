"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const POPUP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

function LoginPopupContent() {
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain") ?? "";
  const app_code = searchParams.get("app_code") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!domain || !app_code) {
      setError("Parâmetros domain e app_code são obrigatórios.");
      setStatus("error");
      return;
    }

    let cancelled = false;

    signIn("credentials", {
      domain,
      app_code,
      redirect: false,
    })
      .then((res) => {
        if (cancelled) return;
        if (res?.error) {
          setError(res.error ?? "Erro no login");
          setStatus("error");
          return;
        }
        setStatus("success");
        try {
          if (window.opener) {
            window.opener.postMessage({ type: "BITRIX_LOGIN_SUCCESS" }, POPUP_ORIGIN);
          }
        } finally {
          window.close();
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? "Erro ao fazer login");
        setStatus("error");
        try {
          if (window.opener) {
            window.opener.postMessage({ type: "BITRIX_LOGIN_ERROR", error: String(err?.message ?? err) }, POPUP_ORIGIN);
          }
        } finally {
          // não fechar para o usuário ver o erro
        }
      });

    return () => {
      cancelled = true;
    };
  }, [domain, app_code]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground">Fazendo login...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4">
        <p className="text-destructive">{error}</p>
        <button
          type="button"
          onClick={() => window.close()}
          className="text-primary hover:underline"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4">
      <p className="text-muted-foreground">Login concluído. Esta janela deve fechar.</p>
      <button type="button" onClick={() => window.close()} className="text-primary hover:underline">
        Fechar janela
      </button>
    </div>
  );
}

export default function BitrixLoginPopupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center">Carregando...</div>}>
      <LoginPopupContent />
    </Suspense>
  );
}
