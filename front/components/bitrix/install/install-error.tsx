import { InstallLayout, InstallCard } from "./install-layout";

interface InstallErrorProps {
  title?: string;
  message: string;
}

const DEFAULT_TITLE = "Atenção";

export function InstallError({ title = DEFAULT_TITLE, message }: InstallErrorProps) {
  return (
    <InstallLayout>
      <InstallCard className="p-8 text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600"
          aria-hidden
        >
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
      </InstallCard>
    </InstallLayout>
  );
}
