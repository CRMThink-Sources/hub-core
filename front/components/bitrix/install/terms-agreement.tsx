"use client";

import {
  BITRIX_EULA_URL,
  BITRIX_MARKET_TERMS_URL,
  BITRIX_PRIVACY_POLICY_URL,
} from "@repo/bitrix";

const LINK_CLASS =
  "font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700";

export interface TermItem {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
}

interface TermsAgreementProps {
  terms: TermItem[];
  title?: string;
}

const DEFAULT_TITLE = "Termos e aceite";

export function TermsAgreement({ terms, title = DEFAULT_TITLE }: TermsAgreementProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <div className="space-y-3 rounded-xl bg-slate-50/80 p-4">
        {terms.map(({ id, checked, onCheckedChange, label }) => (
          <label
            key={id}
            className="flex cursor-pointer gap-3 rounded-lg p-2 transition hover:bg-white/80"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onCheckedChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Configuração dos termos padrão Bitrix24 (referência estável para uso na instalação) */
export const BITRIX_TERMS_CONFIG = [
  {
    id: "market-terms",
    label: (
      <>
        Li e aceito os{" "}
        <a
          href={BITRIX_MARKET_TERMS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Termos de uso do Bitrix24 Market
        </a>
        .
      </>
    ),
  },
  {
    id: "eula",
    label: (
      <>
        Li e aceito o{" "}
        <a
          href={BITRIX_EULA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Contrato de licença (EULA)
        </a>{" "}
        do Bitrix24.
      </>
    ),
  },
  {
    id: "privacy",
    label: (
      <>
        Li e aceito a{" "}
        <a
          href={BITRIX_PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Política de privacidade
        </a>{" "}
        do Bitrix24.
      </>
    ),
  },
] as const;

/** Retorna a configuração dos termos Bitrix24 (alias para BITRIX_TERMS_CONFIG) */
export function useBitrixTermsAgreement() {
  return BITRIX_TERMS_CONFIG;
}
