import React from 'react';
import {
  RefreshCw,
  Zap,
  LogOut,
  User,
} from 'lucide-react';
import { FiltroFecha, SupabaseConfig, ModoLeads } from '../types';
import {
  getRangoMesActual,
  getRangoMesAnterior,
  getHoyIso,
  getEtiquetaMesActual,
  getEtiquetaMesAnterior,
} from '../utils/dateHelpers';

interface HeaderProps {
  filtroFecha: FiltroFecha;
  setFiltroFecha: (f: FiltroFecha) => void;
  onSincronizar: () => void;
  sincronizando: boolean;
  supabaseConfig: SupabaseConfig;
  onAbrirParametros: () => void;
  onAbrirConfigSupabase?: () => void;
  onLogout: () => void;
  usuario?: { nombre: string; rol: string } | null;
  modoLeads?: ModoLeads;
  onAlternarModo?: () => void;
  rangoActivo?: { desde: string; hasta: string };
  onCambiarRangoGlobal?: (desde: string, hasta: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSincronizar,
  sincronizando,
  onAbrirConfigSupabase,
  onLogout,
  usuario,
  modoLeads,
  onAlternarModo,
  rangoActivo,
  onCambiarRangoGlobal,
}) => {
  const mesActual = getRangoMesActual();
  const mesAnterior = getRangoMesAnterior();
  const hoyIso = getHoyIso();

  const esMesActual =
    rangoActivo?.desde === mesActual.inicio && rangoActivo?.hasta === mesActual.fin;
  const esMesAnterior =
    rangoActivo?.desde === mesAnterior.inicio && rangoActivo?.hasta === mesAnterior.fin;
  const esHoy =
    rangoActivo?.desde === hoyIso && rangoActivo?.hasta === hoyIso;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Título & Estado */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-10 w-10 rounded-full object-cover shadow-md border border-slate-700/80 shadow-red-950/30"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  Auditoría de Citas & Cumplimiento Multicanal
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  En Caliente
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rango activo en APIs:{' '}
                <span className="font-mono text-amber-300 font-semibold">
                  {rangoActivo?.desde || mesActual.inicio}
                </span>{' '}
                al{' '}
                <span className="font-mono text-amber-300 font-semibold">
                  {rangoActivo?.hasta || mesActual.fin}
                </span>{' '}
                • Cruce PBX, Celular, WhatsApp y Teams
              </p>
            </div>
          </div>

          {/* Acciones & Filtros */}
          <div className="flex flex-wrap items-center gap-2.5">
            {modoLeads && (
              <button
                type="button"
                onClick={onAlternarModo}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer shadow-sm ${
                  modoLeads === 'calificados'
                    ? 'bg-amber-950/70 border-amber-500/50 text-amber-200 hover:bg-amber-900/60'
                    : 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200 hover:bg-cyan-900/60'
                }`}
                title="Haga clic para alternar entre Leads Calificados y No Calificados"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>
                  {modoLeads === 'calificados' ? 'Modo: Leads Calificados' : 'Modo: No Calificados'}
                </span>
              </button>
            )}

            {/* Modal de Filtro en Caliente y Diagnóstico de APIs */}
            <button
              type="button"
              onClick={onAbrirConfigSupabase}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/40 text-emerald-300 transition-all cursor-pointer shadow-sm group"
              title="Configurar rango o ver estado de las APIs en vivo"
            >
              <Zap className="h-3.5 w-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-white">APIs en Caliente</span>
            </button>

            {/* Selector Rápido de Periodo (Dispara Consulta en Caliente a las APIs) */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() =>
                  onCambiarRangoGlobal && onCambiarRangoGlobal(mesActual.inicio, mesActual.fin)
                }
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  esMesActual
                    ? 'bg-rose-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Consultar mes actual (${mesActual.inicio} a ${mesActual.fin})`}
              >
                Mes Actual
              </button>
              <button
                type="button"
                onClick={() =>
                  onCambiarRangoGlobal && onCambiarRangoGlobal(mesAnterior.inicio, mesAnterior.fin)
                }
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  esMesAnterior
                    ? 'bg-rose-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Consultar mes anterior (${mesAnterior.inicio} a ${mesAnterior.fin})`}
              >
                Mes Anterior
              </button>
              <button
                type="button"
                onClick={() => onCambiarRangoGlobal && onCambiarRangoGlobal(hoyIso, hoyIso)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                  esHoy
                    ? 'bg-rose-600 text-white font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hoy
              </button>
            </div>

            {/* Botón Consultar / Refrescar en Caliente */}
            <button
              onClick={onSincronizar}
              disabled={sincronizando}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
              <span>{sincronizando ? 'Consultando APIs...' : 'Consultar en Caliente'}</span>
            </button>

            {/* Usuario y Logout */}
            {usuario && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 text-xs text-slate-300 border border-slate-700/60">
                  <User className="h-3 w-3 text-indigo-400" />
                  <span className="font-semibold text-white">{usuario.nombre}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                  title="Cerrar Sesión"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
