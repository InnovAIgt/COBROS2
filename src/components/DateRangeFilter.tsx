import React from 'react';
import { Calendar, X, RefreshCw } from 'lucide-react';
import {
  getRangoMesActual,
  getRangoMesAnterior,
  getRangoSemanaActual,
  getHoyIso,
  getEtiquetaMesActual,
  getEtiquetaMesAnterior,
} from '../utils/dateHelpers';

interface DateRangeFilterProps {
  fechaInicio: string;
  fechaFin: string;
  onChangeInicio: (val: string) => void;
  onChangeFin: (val: string) => void;
  onAplicarRango?: (desde: string, hasta: string) => void;
  onLimpiar?: () => void;
  label?: string;
  sincronizando?: boolean;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  fechaInicio,
  fechaFin,
  onChangeInicio,
  onChangeFin,
  onAplicarRango,
  onLimpiar,
  label = 'Filtrar por Rango de Fechas',
  sincronizando = false,
}) => {
  const mesActual = getRangoMesActual();
  const mesAnterior = getRangoMesAnterior();
  const semanaActual = getRangoSemanaActual();
  const hoyIso = getHoyIso();

  const aplicarRangoDirecto = (inicio: string, fin: string) => {
    onChangeInicio(inicio);
    onChangeFin(fin);
    if (onAplicarRango) {
      onAplicarRango(inicio, fin);
    }
  };

  const presets = [
    {
      etiqueta: 'Mes Actual',
      esActivo: fechaInicio === mesActual.inicio && fechaFin === mesActual.fin,
      aplicar: () => aplicarRangoDirecto(mesActual.inicio, mesActual.fin),
    },
    {
      etiqueta: 'Mes Anterior',
      esActivo: fechaInicio === mesAnterior.inicio && fechaFin === mesAnterior.fin,
      aplicar: () => aplicarRangoDirecto(mesAnterior.inicio, mesAnterior.fin),
    },
    {
      etiqueta: 'Esta Semana',
      esActivo: fechaInicio === semanaActual.inicio && fechaFin === semanaActual.fin,
      aplicar: () => aplicarRangoDirecto(semanaActual.inicio, semanaActual.fin),
    },
    {
      etiqueta: 'Hoy',
      esActivo: fechaInicio === hoyIso && fechaFin === hoyIso,
      aplicar: () => aplicarRangoDirecto(hoyIso, hoyIso),
    },
  ];

  const esDiferenteAlMesActual =
    fechaInicio !== mesActual.inicio || fechaFin !== mesActual.fin;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-xs">
      <div className="flex items-center gap-1.5 text-slate-400 font-medium mr-1">
        <Calendar className="h-3.5 w-3.5 text-rose-400" />
        <span className="hidden sm:inline">{label}:</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-500 uppercase">Desde</span>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => {
            const nuevoDesde = e.target.value;
            onChangeInicio(nuevoDesde);
            if (onAplicarRango && nuevoDesde && fechaFin) {
              onAplicarRango(nuevoDesde, fechaFin);
            }
          }}
          className="bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
        />
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-500 uppercase">Hasta</span>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => {
            const nuevoHasta = e.target.value;
            onChangeFin(nuevoHasta);
            if (onAplicarRango && fechaInicio && nuevoHasta) {
              onAplicarRango(fechaInicio, nuevoHasta);
            }
          }}
          className="bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
        />
      </div>

      {onAplicarRango && (
        <button
          type="button"
          onClick={() => onAplicarRango(fechaInicio, fechaFin)}
          disabled={sincronizando}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          title="Consultar APIs en caliente con este rango de fechas"
        >
          <RefreshCw className={`h-3 w-3 ${sincronizando ? 'animate-spin' : ''}`} />
          <span>Consultar API</span>
        </button>
      )}

      {/* Botones de presets rápidos 100% dinámicos */}
      <div className="flex flex-wrap items-center gap-1 ml-1 border-l border-slate-800 pl-2">
        {presets.map((p) => (
          <button
            key={p.etiqueta}
            type="button"
            onClick={p.aplicar}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              p.esActivo
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {esDiferenteAlMesActual && onLimpiar && (
        <button
          type="button"
          onClick={() => {
            aplicarRangoDirecto(mesActual.inicio, mesActual.fin);
            onLimpiar();
          }}
          className="flex items-center gap-1 text-[11px] px-2 py-1 bg-rose-950/60 border border-rose-800/60 rounded text-rose-300 hover:bg-rose-900/60 transition-all ml-auto sm:ml-0 cursor-pointer"
          title="Restablecer al mes actual por defecto"
        >
          <X className="h-3 w-3" />
          <span>Mes Actual</span>
        </button>
      )}
    </div>
  );
};
