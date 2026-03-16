import { InstallLayout, InstallCard } from "./install-layout";

interface InstallSuccessProps {
  title?: string;
  description?: string;
}

const DEFAULT_TITLE = "Instalação concluída";
const DEFAULT_DESCRIPTION =
  "O aplicativo foi instalado com sucesso. Você já pode utilizá-lo no Bitrix24.";

export function InstallSuccess({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: InstallSuccessProps) {
  return (
    <InstallLayout>
      <InstallCard className="p-10 text-center">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-4 ring-emerald-100/80"
          aria-hidden
        >
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="mt-3 text-slate-600">{description}</p>
      </InstallCard>
    </InstallLayout>
  );
}
