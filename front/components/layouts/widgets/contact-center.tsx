"use client";
import { useBX24 } from "@repo/bitrix";
import axios from "axios";
import { useEffect, useState } from "react";

interface PlacementInfo {
  placement: string;
  options: Record<string, string>;
}

export const ContactCenterView = ({ scriptLoaded }: { scriptLoaded: boolean }) => {
  const { ready, error: bx24Error, getInstallPayload, finishInstall } = useBX24(scriptLoaded);
  const [connectors, setConnectors] = useState<any[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string>("");
  const [placementInfo, setPlacementInfo] = useState<PlacementInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ready || !window.BX24) return;

    window.BX24?.fitWindow?.(() => {
      window.BX24?.resizeWindow?.(600, 400);
    });

    const info = window.BX24?.placement?.info?.();
    if (info) {
      setPlacementInfo(info);
      console.log("Placement info:", info);
    }
  }, [ready]);

  const loadConnectors = async () => {
    const { data: { result: { connectors } } } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/thinkerszap/connector/list`, {
      headers: {
        "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkb21haW5JZCI6ImU5OTljZDM2LTkxMDItNGFmMC04NjUyLTdiZjNlZDcxMjA0MiIsImFwcENvZGVJZCI6IjEiLCJpYXQiOjE3NzA4NDg3OTl9.m5E0cqb_L683Q3H8aFA9EoKGrRPTgRaOzp1GzFpUItk`
      }
    });
    setConnectors(connectors.filter((connector: any) => connector.phoneData));
  };

  useEffect(() => {
    loadConnectors();
  }, []);

  const handleSave = async () => {
    if (!selectedConnectorId || !placementInfo) return;
    setSaving(true);
    try {
      const lineId = placementInfo.options?.LINE;
      const connector = placementInfo.options?.CONNECTOR;
      // console.log({ placementInfo })
      // console.log("Vinculando connector", selectedConnectorId, "ao canal aberto", lineId);
      // console.log("Placement options completas:", placementInfo.options);

      console.log({
        selectedConnectorId,
        lineId,
        connector,
      })

      // window.BX24?.callMethod("imconnector.activate", {
      //   CONNECTOR: placementInfo.options.CONNECTOR,
      //   LINE: placementInfo.options.LINE,
      //   ACTIVE: 1
      // }, result => {
      //   window.BX24.reloadWindow()
      // })

      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Erro ao vincular:", err);
    } finally {
      setSaving(false);
    }
  };

  const lineId = placementInfo?.options?.LINE_ID;

  return (
    <div className="w-full min-h-full p-5 bg-neutral-950 text-white flex flex-col gap-5">
      <h1 className="text-xl font-bold tracking-tight">Vincular WhatsApp</h1>

      <section className="rounded-xl bg-white p-5 shadow-sm border border-neutral-200 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 mb-1">Vincular ao Canal Aberto</h2>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Selecione qual número de WhatsApp será vinculado
            {lineId ? ` ao Canal Aberto ${lineId}` : " ao canal aberto selecionado"}.
          </p>
        </div>

        {connectors.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">Nenhum número disponível. Cadastre um conector primeiro.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <label htmlFor="connector-select" className="text-sm font-medium text-neutral-700">
              Número WhatsApp
            </label>
            <select
              id="connector-select"
              value={selectedConnectorId}
              onChange={(e) => {
                setSelectedConnectorId(e.target.value);
                setSaved(false);
              }}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
            >
              <option value="">Selecione um número...</option>
              {connectors.map((connector: any) => (
                <option key={connector.id} value={connector.id}>
                  {connector.phoneData.phone} — {connector.phoneData.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSave}
              disabled={!selectedConnectorId || saving}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Vinculando..." : saved ? "Vinculado!" : "Vincular"}
            </button>
          </div>
        )}
      </section>

      {placementInfo && (
        <p className="text-xs text-neutral-500">
          Placement: {placementInfo.placement}
          {lineId && ` · Canal Aberto: ${lineId}`}
        </p>
      )}
    </div>
  );
}
