import { InstallLayout } from "./install-layout";

interface InstallLoadingProps {
  message?: string;
}

const DEFAULT_MESSAGE = "Carregando...";

export function InstallLoading({ message = DEFAULT_MESSAGE }: InstallLoadingProps) {
  return (
    <InstallLayout>
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    </InstallLayout>
  );
}
