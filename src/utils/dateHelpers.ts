/**
 * Helpers de fecha 100% dinámicos basados en el reloj del sistema.
 * CERO fechas quemadas (prohibido hardcodear meses o años fijos).
 */

export function formatearFechaLocalIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getHoyIso(baseDate?: Date | string): string {
  const d = baseDate ? new Date(baseDate) : new Date();
  return formatearFechaLocalIso(d);
}

/**
 * Obtiene el rango del mes actual calendario dinámicamente (día 01 al último día del mes en curso)
 */
export function getRangoMesActual(baseDate?: Date | string): { inicio: string; fin: string } {
  const ahora = baseDate ? new Date(baseDate) : new Date();
  const year = ahora.getFullYear();
  const month = ahora.getMonth();
  const ultimoDia = new Date(year, month + 1, 0).getDate();

  const mm = String(month + 1).padStart(2, '0');
  const ddFin = String(ultimoDia).padStart(2, '0');

  return {
    inicio: `${year}-${mm}-01`,
    fin: `${year}-${mm}-${ddFin}`,
  };
}

/**
 * Obtiene el rango por defecto para todas las consultas al iniciar el sistema: Mes Actual
 */
export function getRangoDefaultLeads(baseDate?: Date | string): { inicio: string; fin: string } {
  return getRangoMesActual(baseDate);
}

/**
 * Obtiene dinámicamente el rango del mes inmediatamente anterior al actual
 */
export function getRangoMesAnterior(baseDate?: Date | string): { inicio: string; fin: string } {
  const ahora = baseDate ? new Date(baseDate) : new Date();
  const primerDiaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const ultimoDiaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth(), 0);

  return {
    inicio: formatearFechaLocalIso(primerDiaMesAnterior),
    fin: formatearFechaLocalIso(ultimoDiaMesAnterior),
  };
}

/**
 * Obtiene el rango de la semana actual calendario (Lunes a Domingo) dinámicamente
 */
export function getRangoSemanaActual(baseDate?: Date | string): { inicio: string; fin: string } {
  const ahora = baseDate ? new Date(baseDate) : new Date();
  const diaSemana = ahora.getDay(); // 0 = Domingo, 1 = Lunes, ...
  const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

  const lunes = new Date(ahora);
  lunes.setDate(ahora.getDate() + diffLunes);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  return {
    inicio: formatearFechaLocalIso(lunes),
    fin: formatearFechaLocalIso(domingo),
  };
}

/**
 * Obtiene dinámicamente el nombre legible del mes actual (ej: "Octubre 2026")
 */
export function getEtiquetaMesActual(baseDate?: Date | string): string {
  const ahora = baseDate ? new Date(baseDate) : new Date();
  const txt = new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric' }).format(ahora);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/**
 * Obtiene dinámicamente el nombre legible del mes anterior
 */
export function getEtiquetaMesAnterior(baseDate?: Date | string): string {
  const ahora = baseDate ? new Date(baseDate) : new Date();
  const mesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const txt = new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric' }).format(mesAnt);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/**
 * Valida si una fecha es futura/próxima (estrictamente mayor a hoy)
 */
export function esFechaProxima(fechaStrOVal?: string | null): boolean {
  if (!fechaStrOVal) return false;
  const str = String(fechaStrOVal).trim();
  const f = str.slice(0, 10);
  if (!f || f.length < 10) return false;

  const hoyStr = getHoyIso();
  return f > hoyStr;
}

/**
 * Valida dinámicamente si un registro pertenece al mes en curso (o al mes de una fecha dada)
 */
export function esDelMesActual(
  item: any,
  dateKeys: string[] = [
    'fecha_agendada',
    'fecha_creado',
    'fecha_hora',
    'fecha_hora_inicio',
    'fecha_llamada',
    'fecha',
    'created_at',
    'created_at_sv',
    'calldate',
    'solo_fecha',
  ],
  baseDate?: Date
): boolean {
  if (!item) return false;
  const ahora = baseDate || new Date();
  const year = ahora.getFullYear();
  const monthNum = ahora.getMonth() + 1;
  const mm = String(monthNum).padStart(2, '0');
  const mesTargetIso = `${year}-${mm}`;

  for (const k of dateKeys) {
    const val = item[k];
    if (val) {
      const s = String(val).trim();
      if (s.startsWith(mesTargetIso)) return true;
      if (
        s.includes(`/${mm}/${year}`) ||
        s.includes(`-${mm}-${year}`) ||
        s.includes(`${year}-${mm}`) ||
        s.includes(`${year}/${mm}`)
      ) {
        return true;
      }
    }
  }

  if (
    Number(item.mes) === monthNum &&
    Number(item.anio) === year
  ) {
    return true;
  }
  return false;
}

export function getRangoSemanaCalendario(): { inicio: string; fin: string } {
  return getRangoSemanaActual();
}
