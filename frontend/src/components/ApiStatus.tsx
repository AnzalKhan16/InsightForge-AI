"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

interface Health {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: Health }
  | { kind: "error"; message: string };

export default function ApiStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    apiFetch<Health>("/health")
      .then((data) => setState({ kind: "ok", data }))
      .catch((e: unknown) =>
        setState({ kind: "error", message: e instanceof ApiError ? e.message : "Unknown error" }),
      );
  }, []);

  const color =
    state.kind === "ok" ? "bg-emerald-400" : state.kind === "error" ? "bg-rose-500" : "bg-amber-400";

  return (
    <div
      id="api-status"
      className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${color} ${state.kind === "loading" ? "animate-pulse" : ""}`} />
        <span className="text-sm font-medium">
          {state.kind === "loading" && "Checking backend…"}
          {state.kind === "ok" && "Backend connected"}
          {state.kind === "error" && "Backend unreachable"}
        </span>
      </div>
      {state.kind === "ok" && (
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-xs text-slate-300">
          <dt className="text-slate-500">Service</dt>
          <dd>{state.data.service}</dd>
          <dt className="text-slate-500">Version</dt>
          <dd>{state.data.version}</dd>
          <dt className="text-slate-500">Environment</dt>
          <dd>{state.data.environment}</dd>
        </dl>
      )}
      {state.kind === "error" && <p className="mt-3 text-xs text-rose-300">{state.message}</p>}
    </div>
  );
}
