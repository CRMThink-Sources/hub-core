
const DEFAULT_APP_REDIRECTS: Record<string, string> = {
  "local.6983ae84bf5ee2.04249563": "/apps/thinkzap",
};


let cached: Record<string, string> | null = null;

export function getAppRedirectUrl(appCode: string): string | null {
  const url = DEFAULT_APP_REDIRECTS[appCode];
  if (url === undefined) return null;
  return url;
}

/** Nome do cookie de auth (env NEXT_PUBLIC_AUTH_COOKIE_NAME). Quando setado, o token é enviado via cookie e a URL de redirect fica limpa. */
export const AUTH_COOKIE_NAME =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AUTH_COOKIE_NAME) || "hubthink_auth_token";

/** Domínio do cookie (env NEXT_PUBLIC_AUTH_COOKIE_DOMAIN). Ex: ".seudominio.com" para auth.seudominio.com e whatsapp.seudominio.com. Se não setado, o token vai na URL. */
export const AUTH_COOKIE_DOMAIN =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN) || "";
