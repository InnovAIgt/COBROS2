import React, { useState } from 'react';
import {
  X,
  Database,
  RefreshCw,
  Table,
  Phone,
  Zap,
  Calendar,
  Activity,
  Server,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { SupabaseConfig } from '../types';
import { getRangoMesActual, getRangoMesAnterior, getHoyIso } from '../utils/dateHelpers';

interface SupabaseConfigModalProps {
  abierto: boolean;
  onCerrar: () => void;
  config: SupabaseConfig;
  onGuardar: (nuevaConfig: SupabaseConfig) => void;
  onProbarSync?: () => void;
  onDatosActualizados?: (rango?: { desde: string; hasta: string; pais?: string }) => void;
  diagnosticoActual?: any;
  rangoActual?: { desde: string; hasta: string; pais?: string };
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  abierto,
  onCerrar,
  onDatosActualizados,
  diagnosticoActual,
  rangoActual,
}) => {
  const mesActual = getRangoMesActual();
  const mesAnterior = getRangoMesAnterior();

  const [fechaDesde, setFechaDesde] = useState(rangoActual?.desde || mesActual.inicio);
  const [fechaHasta, setFechaHasta] = useState(rangoActual?.hasta || mesActual.fin);
  const [paisSync, setPaisSync] = useState<'AMBOS' | 'SV' | 'GT'>(
    (rangoActual?.pais as any) || 'AMBOS'
  );
  const [consultando, setConsultando] = useState(false);

  if (!abierto) return null;

  const handleConsultarEnCaliente = async () => {
    setConsultando(true);
    try {
      if (onDatosActualizados) {
        await onDatosActualizados({
          desde: fechaDesde,
          hasta: fechaHasta,
          pais: paisSync,
        });
      }
      onCerrar();
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Motor Backend de Consulta en Caliente (APIs Directas)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  100% Backend Local
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Todas las claves, parámetros y credenciales PBX están integrados directamente en el backend
              </p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Credenciales y Endpoints configurados en el Backend */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <KeyRound className="h-4 w-4 text-emerald-400" />
                <span>Parámetros y Claves Activas en el Backend (server.ts):</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Configurado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <div className="text-slate-400 font-medium">1. API Telefonía PBX (JWT Login + getCalls2)</div>
                <div className="text-white font-mono mt-0.5 truncate">https://api.red.com.sv/pbx/api/v1/getCalls2</div>
                <div className="text-amber-300 font-mono text-[10px] mt-0.5">
                  Usuario: DMONGE | Pass: *Sunfl0wer* | Países: SV + GT
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <div className="text-slate-400 font-medium">2. API Prospektia (Calificados y No Calificados)</div>
                <div className="text-white font-mono mt-0.5 truncate">https://prospektia.red.com.sv/api/external/leads-calificados</div>
                <div className="text-emerald-300 font-mono text-[10px] mt-0.5">
                  X-API-Key: RedApi_2026_SuperSegura_9XK2
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <div className="text-slate-400 font-medium">3. API Historial Llamadas Celular</div>
                <div className="text-white font-mono mt-0.5 truncate">https://kpi.red.com.sv/api/historial-llamadas-ejecutivos</div>
                <div className="text-blue-300 font-mono text-[10px] mt-0.5">
                  X-API-KEY: mso_papi_2026_7f2b9c4d8e6a1b3f5d7c9e0a2b4c6d8f
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                <div className="text-slate-400 font-medium">4. Llamadas WhatsApp (Supabase)</div>
                <div className="text-white font-mono mt-0.5 truncate">public.llamadas_whatsapp (Supabase REST)</div>
                <div className="text-indigo-300 font-mono text-[10px] mt-0.5">
                  Única fuente traída de Supabase; demás APIs en caliente
                </div>
              </div>
            </div>
          </div>

          {/* Explicación de arquitectura en caliente */}
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
              <Activity className="h-4 w-4 text-indigo-400" />
              <span>Regla de Consulta en Caliente:</span>
            </div>
            <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                <strong className="text-white">Por defecto solo Mes Actual:</strong> Al abrir el sistema se consulta automáticamente solo el mes en curso (<code className="text-emerald-300">{mesActual.inicio}</code> al <code className="text-emerald-300">{mesActual.fin}</code>) sin traer toda la historia.
              </li>
              <li>
                <strong className="text-white">Consulta bajo demanda por Filtros:</strong> Cada vez que eliges un rango de fechas, el backend invoca en caliente las APIs para ese periodo exacto.
              </li>
            </ul>
          </div>

          {/* Selector de Rango para Consulta en Caliente */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-rose-400" />
                  Invocar Consulta en Caliente por Rango de Fechas
                </h4>
                <p className="text-[11px] text-slate-400">
                  Selecciona el periodo o usa un acceso rápido para consultar todas las APIs en vivo:
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setFechaDesde(mesActual.inicio);
                    setFechaHasta(mesActual.fin);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium cursor-pointer border border-slate-700"
                >
                  Mes Actual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFechaDesde(mesAnterior.inicio);
                    setFechaHasta(mesAnterior.fin);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 text-[11px] font-medium cursor-pointer border border-indigo-700/60"
                >
                  Mes Anterior
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const hoy = getHoyIso();
                    setFechaDesde(hoy);
                    setFechaHasta(hoy);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium cursor-pointer border border-slate-700"
                >
                  Hoy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase">
                  Desde:
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase">
                  Hasta:
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase">
                  País:
                </label>
                <select
                  value={paisSync}
                  onChange={(e: any) => setPaisSync(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <option value="AMBOS">Ambos Países (🇸🇻 SV + 🇬🇹 GT)</option>
                  <option value="SV">Solo El Salvador (SV)</option>
                  <option value="GT">Solo Guatemala (GT)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleConsultarEnCaliente}
                disabled={consultando}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${consultando ? 'animate-spin' : ''}`} />
                <span>
                  {consultando
                    ? 'Consultando APIs en Caliente...'
                    : `Consultar Rango en Caliente (${fechaDesde} a ${fechaHasta})`}
                </span>
              </button>
            </div>
          </div>

          {/* Estado de última consulta en vivo */}
          {diagnosticoActual && (
            <div className="space-y-2">
              <h4 className="text-white font-bold text-xs">
                Resultados de la Consulta Actual en Backend:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4 text-amber-400" />
                    <div>
                      <div className="font-semibold text-white">Leads Calificados</div>
                      <div className="text-[10px] text-slate-400">API Prospektia en vivo</div>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-amber-300">
                    {diagnosticoActual?.leads_calificados_api?.total ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Table className="h-4 w-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold text-white">No Calificados</div>
                      <div className="text-[10px] text-slate-400">API Audit Prospektia</div>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-cyan-300">
                    {diagnosticoActual?.leads_no_calificados_api?.total ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-rose-400" />
                    <div>
                      <div className="font-semibold text-white">Llamadas PBX</div>
                      <div className="text-[10px] text-slate-400">getCalls2 (Token DMONGE)</div>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-rose-300">
                    {diagnosticoActual?.llamadas_pbx_api?.total ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-400" />
                    <div>
                      <div className="font-semibold text-white">Llamadas Celular</div>
                      <div className="text-[10px] text-slate-400">API KPI Ejecutivos</div>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-blue-300">
                    {diagnosticoActual?.llamadas_celular_api?.total ?? 0}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-white">WhatsApp</div>
                      <div className="text-[10px] text-slate-400">Almacén Backend</div>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-emerald-300">
                    {diagnosticoActual?.llamadas_whatsapp_backend?.total ??
                      diagnosticoActual?.llamadas_whatsapp_supabase?.total ??
                      0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
