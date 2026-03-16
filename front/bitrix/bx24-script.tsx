"use client";

import { useEffect, useRef } from "react";
import { BX24_SCRIPT_URL } from "./constants";

interface BX24ScriptProps {
  onLoad: () => void;
}

/**
 * Injeta o script oficial do BX24. Deve ser renderizado na página de instalação
 * que roda dentro do iframe do Bitrix24.
 * Em apps Next.js você pode usar next/script com src={BX24_SCRIPT_URL} em vez deste componente.
 */
export function BX24Script({ onLoad }: BX24ScriptProps) {
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const calledRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const script = document.createElement("script");
    script.src = BX24_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (!calledRef.current) {
        calledRef.current = true;
        onLoadRef.current();
      }
    };
    script.onerror = () => {
      if (!calledRef.current) {
        calledRef.current = true;
        onLoadRef.current();
      }
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return null;
}
