"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";

export default function BitrixLogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/" });
  }, []);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Saindo...</h1>
      <p className="text-muted-foreground text-sm">Você será redirecionado em instantes.</p>
    </div>
  );
}
