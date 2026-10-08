import { Cita, Llamada } from '../types';
import { getRangoMesActual } from '../utils/dateHelpers';

export interface FiltrosConsultaEnCaliente {
  desde?: string;
  hasta?: string;
  pais?: string;
  asesor?: string;
  tipo_reunion?: string;
}

export interface DatosSyncBackend {
  citasCalificadas: Cita[];
  citasNoCalificadas: Cita[];
  citas: Cita[];
  llamadas: Llamada[];
  catalogo: any[];
  rawPbx: any[];
  rawCelular: any[];
  rawWhatsapp: any[];
  rawLeads: any[];
  rawLeadsNoCalificados: any[];
  rawTeams: any[];
  estadisticas: Record<string, number>;
  diagnostico?: any;
  rango?: { desde: string; hasta: string; pais?: string };
  tiempo_ms: number;
}

/**
 * Consulta en caliente el endpoint del backend (/api/sync/datos-completos)
 * enviando los filtros de fecha (por defecto: mes actual en todas las APIs).
 * Cero llamadas ni dependencias de Supabase.
 */
export async function sincronizarDatosDesdeBackend(
  filtros?: FiltrosConsultaEnCaliente
): Promise<DatosSyncBackend> {
  const inicio = performance.now();
  const rangoMes = getRangoMesActual();
  const desde = filtros?.desde !== undefined ? filtros.desde : rangoMes.inicio;
  const hasta = filtros?.hasta !== undefined ? filtros.hasta : rangoMes.fin;

  const qs = new URLSearchParams();
  if (desde) qs.set('desde', desde);
  if (hasta) qs.set('hasta', hasta);
  if (filtros?.pais) qs.set('pais', filtros.pais);
  if (filtros?.asesor) qs.set('asesor', filtros.asesor);
  if (filtros?.tipo_reunion) qs.set('tipo_reunion', filtros.tipo_reunion);

  try {
    const res = await fetch(`/api/sync/datos-completos?${qs.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json.exito && json.datos) {
        const {
          catalogo = [],
          leads = [],
          leadsNoCalificados = [],
          llamadasPbx = [],
          llamadasCelular = [],
          llamadasTeams = [],
          llamadasWhatsapp = [],
        } = json.datos;

        const mapaCatalogo = {
          porExtension: {} as Record<string, any>,
          porUsuario: {} as Record<string, any>,
          porCelular: {} as Record<string, any>,
          porNombre: {} as Record<string, any>,
        };

        catalogo.forEach((c: any) => {
          if (c.extension) mapaCatalogo.porExtension[String(c.extension).trim()] = c;
          if (c.usuario) mapaCatalogo.porUsuario[String(c.usuario).trim().toLowerCase()] = c;
          if (c.nombre_ejecutivo) mapaCatalogo.porNombre[String(c.nombre_ejecutivo).trim().toLowerCase()] = c;
          if (c.celular) {
            const cleanTel = String(c.celular).replace(/[^0-9]/g, '');
            mapaCatalogo.porCelular[cleanTel] = c;
          }
        });

        const resolverAsesor = (
          extOrUserOrCel: string,
          fallback: string = 'Asesor General'
        ): string => {
          if (!extOrUserOrCel) return fallback;
          const clean = String(extOrUserOrCel).trim();
          const cleanUser = clean.toLowerCase();
          if (mapaCatalogo.porUsuario[cleanUser]) return mapaCatalogo.porUsuario[cleanUser].nombre_ejecutivo;
          if (mapaCatalogo.porExtension[clean]) return mapaCatalogo.porExtension[clean].nombre_ejecutivo;
          if (mapaCatalogo.porNombre[cleanUser]) return mapaCatalogo.porNombre[cleanUser].nombre_ejecutivo;
          const cleanTel = clean.replace(/[^0-9]/g, '');
          if (cleanTel && mapaCatalogo.porCelular[cleanTel]) return mapaCatalogo.porCelular[cleanTel].nombre_ejecutivo;

          for (const cat of catalogo) {
            if (cat.usuario && cleanUser.includes(String(cat.usuario).toLowerCase())) return cat.nombre_ejecutivo;
            if (cat.nombre_ejecutivo && cleanUser.includes(String(cat.nombre_ejecutivo).toLowerCase())) return cat.nombre_ejecutivo;
          }
          return fallback;
        };

        const citasCalificadas: Cita[] = [];
        const citasNoCalificadas: Cita[] = [];

        const extraerFechaHoraLead = (lead: any) => {
          const fAgendada = lead.fecha_agendada && lead.fecha_agendada !== 'null' ? String(lead.fecha_agendada).trim().slice(0, 10) : '';
          let hAgendada = lead.hora_agendada && lead.hora_agendada !== 'null' ? String(lead.hora_agendada).trim() : '';
          const fCreado = lead.fecha_creado && lead.fecha_creado !== 'null' ? String(lead.fecha_creado).trim().slice(0, 10) : '';
          let hCreado = lead.hora_creado && lead.hora_creado !== 'null' ? String(lead.hora_creado).trim() : '';
          const fCreatedAt = lead.created_at ? String(lead.created_at).slice(0, 10) : '';
          let hCreatedAt = lead.created_at ? String(lead.created_at).slice(11, 19) : '';

          const tieneCitaAgendada = Boolean(fAgendada && fAgendada.length >= 8);

          const fechaDef = fAgendada || fCreado || fCreatedAt || new Date().toISOString().slice(0, 10);
          let horaDef = hAgendada || hCreado || hCreatedAt || '09:00:00';
          if (horaDef.length === 5) horaDef += ':00';

          return {
            fechaIso: `${fechaDef}T${horaDef}`,
            fechaAgendada: fAgendada || '',
            horaAgendada: hAgendada || '',
            fechaCreado: fCreado || fCreatedAt,
            horaCreado: hCreado || hCreatedAt,
            tieneCitaAgendada,
          };
        };

        const extraerFechaHoraNoCalificado = (lead: any) => {
          if (lead.fecha && lead.hora) {
            return {
              fechaIso: `${lead.fecha}T${lead.hora}`,
              fecha: lead.fecha,
              hora: lead.hora,
            };
          }
          if (lead.created_at_sv && typeof lead.created_at_sv === 'string') {
            const match = lead.created_at_sv.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
            if (match) {
              const [, dd, mm, yyyy, hh, min, ampm] = match;
              let hourNum = parseInt(hh, 10);
              if (ampm) {
                if (ampm.toUpperCase() === 'PM' && hourNum < 12) hourNum += 12;
                if (ampm.toUpperCase() === 'AM' && hourNum === 12) hourNum = 0;
              }
              const dStr = String(parseInt(dd, 10)).padStart(2, '0');
              const mStr = String(parseInt(mm, 10)).padStart(2, '0');
              const hourStr = String(hourNum).padStart(2, '0');
              const f = `${yyyy}-${mStr}-${dStr}`;
              const h = `${hourStr}:${min}:00`;
              return { fechaIso: `${f}T${h}`, fecha: f, hora: h };
            }
          }

          if (lead.created_at) {
            const d = new Date(lead.created_at);
            if (!isNaN(d.getTime())) {
              const svDate = new Date(d.getTime() - 6 * 3600 * 1000);
              const yyyy = svDate.getUTCFullYear();
              const mm = String(svDate.getUTCMonth() + 1).padStart(2, '0');
              const dd = String(svDate.getUTCDate()).padStart(2, '0');
              const hh = String(svDate.getUTCHours()).padStart(2, '0');
              const min = String(svDate.getUTCMinutes()).padStart(2, '0');
              const ss = String(svDate.getUTCSeconds()).padStart(2, '0');
              const f = `${yyyy}-${mm}-${dd}`;
              const h = `${hh}:${min}:${ss}`;
              return { fechaIso: `${f}T${h}`, fecha: f, hora: h };
            }
          }

          return { fechaIso: new Date().toISOString(), fecha: '', hora: '' };
        };

        // A. Leads Calificados
        leads.forEach((lead: any, idx: number) => {
          const { fechaIso, fechaAgendada, horaAgendada, fechaCreado, horaCreado, tieneCitaAgendada } =
            extraerFechaHoraLead(lead);

          lead.fecha_agendada = fechaAgendada || null;
          lead.hora_agendada = horaAgendada || null;
          lead.fecha_creado = fechaCreado;
          lead.hora_creado = horaCreado;
          lead.fecha_hora_programada = fechaIso;
          lead.tiene_cita_agendada = tieneCitaAgendada;

          const asesor =
            lead.asesor_nombre ||
            resolverAsesor(lead.asesor_id || '', 'Asesor General');
          lead.asesor_nombre = asesor;

          const nombreProspecto =
            lead.nombre_prospecto ||
            lead.nombre ||
            lead.cliente ||
            (lead.codigo_prospecto ? `Prospecto ${lead.codigo_prospecto}` : `Lead #${idx + 1}`);

          citasCalificadas.push({
            id: String(lead.id || lead.codigo_prospecto || `lead-${idx}`),
            codigo_prospecto: lead.codigo_prospecto,
            prospecto_nombre: nombreProspecto,
            prospecto_telefono: String(lead.telefono || lead.celular || lead.movil || '').trim(),
            prospecto_email: lead.asesor_email || lead.email || '',
            vendedor_id: asesor.toLowerCase().replace(/\s+/g, '_'),
            vendedor_nombre: asesor,
            fecha_hora_programada: fechaIso,
            fecha_agendada: fechaAgendada || undefined,
            hora_agendada: horaAgendada || undefined,
            fecha_creado: fechaCreado || undefined,
            hora_creado: horaCreado || undefined,
            created_at: lead.created_at || undefined,
            pais: lead.pais || 'SV',
            estado_cita: lead.status === 'cancelada' ? 'cancelada' : 'programada',
            fuente: 'API',
            tipo_reunion: (lead.tipo_reunion as any) || 'Llamada Telefonica',
            tipo_lead: 'calificados',
            notas: `País: ${lead.pais || 'SV'}`,
            kpi_sla_etapa_1: Boolean(lead.kpi_sla_etapa_1),
            kpi_sla_etapa_2: Boolean(lead.kpi_sla_etapa_2),
            kpi_sla_etapa_3: Boolean(lead.kpi_sla_etapa_3),
            kpi_retroalimentacion_etapa_1: Boolean(lead.kpi_retroalimentacion_etapa_1),
            kpi_retroalimentacion_etapa_2: Boolean(lead.kpi_retroalimentacion_etapa_2),
            kpi_retroalimentacion_etapa_3: Boolean(lead.kpi_retroalimentacion_etapa_3),
            kpi_retroalimentacion_etapa_4: Boolean(lead.kpi_retroalimentacion_etapa_4),
          });
        });

        // B. Leads No Calificados
        leadsNoCalificados.forEach((lead: any, idx: number) => {
          const parsed = extraerFechaHoraNoCalificado(lead);
          lead.fecha = parsed.fecha;
          lead.hora = parsed.hora;
          lead.fecha_hora_programada = parsed.fechaIso;

          const telClean = String(
            lead.telefono || lead.client_phone || lead.celular || lead.numero || ''
          ).replace(/^null$/i, '').trim();
          lead.telefono = telClean;

          const asesor = lead.advisor_name || lead.asesor || 'Asesor Asignado';
          lead.advisor_name = asesor;

          const nombreCliente =
            lead.client_name ||
            lead.nombre ||
            lead.prospecto ||
            (lead.client_id ? `Cliente ${lead.client_id}` : `No Calif. #${idx + 1}`);

          citasNoCalificadas.push({
            id: String(lead.id || lead.client_id || `no-calif-${idx}`),
            codigo_prospecto: lead.client_id,
            prospecto_nombre: nombreCliente,
            prospecto_telefono: telClean,
            prospecto_email: lead.email || '',
            vendedor_id: asesor.toLowerCase().replace(/\s+/g, '_'),
            vendedor_nombre: asesor,
            fecha_hora_programada: parsed.fechaIso,
            fecha_agendada: parsed.fecha,
            hora_agendada: parsed.hora,
            fecha_creado: parsed.fecha,
            hora_creado: parsed.hora,
            created_at: lead.created_at || undefined,
            pais: lead.pais || (telClean.startsWith('502') ? 'GT' : 'SV'),
            estado_cita: 'no_show',
            fuente: 'API',
            tipo_reunion: 'Discovery Call',
            tipo_lead: 'no_calificados',
            notas: `Lead No Calificado`,
            kpi_sla_etapa_1: Boolean(lead.kpi_sla_etapa_1),
            kpi_sla_etapa_2: Boolean(lead.kpi_sla_etapa_2),
            kpi_sla_etapa_3: Boolean(lead.kpi_sla_etapa_3),
            kpi_retroalimentacion_etapa_1: Boolean(lead.kpi_retroalimentacion_etapa_1),
            kpi_retroalimentacion_etapa_2: Boolean(lead.kpi_retroalimentacion_etapa_2),
            kpi_retroalimentacion_etapa_3: Boolean(lead.kpi_retroalimentacion_etapa_3),
            kpi_retroalimentacion_etapa_4: Boolean(lead.kpi_retroalimentacion_etapa_4),
          });
        });

        // 3. Mapear Llamadas Multicanal
        const llamadas: Llamada[] = [];

        // A. PBX (getCalls2)
        llamadasPbx.forEach((call: any, idx: number) => {
          const durSec =
            Number(call.duracion_segundos || 0) ||
            Number(call.duracion_minutos || 0) * 60;
          const fechaInicio =
            call.fecha_hora ||
            (call.fecha ? `${call.fecha}T${call.hora || '00:00:00'}` : new Date().toISOString());

          const ext = String(call.extension || '').trim();
          const asesor =
            call.asesor_nombre ||
            resolverAsesor(call.nombre || '', resolverAsesor(ext, ext ? `Ext. ${ext}` : 'Línea PBX'));
          call.asesor_nombre = asesor;

          const estadoNorm = String(call.estado || '').toLowerCase();
          const esContestada =
            estadoNorm === 'answered' ||
            estadoNorm === 'contestada' ||
            durSec > 25;

          llamadas.push({
            id: String(call.uniqueid || call.id || `pbx-${idx}`),
            vendedor_id: asesor.toLowerCase().replace(/\s+/g, '_'),
            vendedor_nombre: asesor,
            telefono_marcado: String(call.destino || '').trim(),
            prospecto_nombre: call.nombre || undefined,
            fecha_hora_inicio: fechaInicio,
            fecha_hora_fin: fechaInicio,
            duracion_segundos: durSec,
            resultado: esContestada ? 'contestada' : 'no_contesta',
            proveedor: 'VoIP',
            canal_tipo: 'PBX',
            grabacion_url: call.audio_url || call.grabacion_url || undefined,
            notas_llamada: `[PBX] Ext: ${ext || 'N/D'} | País: ${call.pais || 'SV'}`,
          });
        });

        // B. Celular
        llamadasCelular.forEach((cel: any, idx: number) => {
          let durSec = 0;
          if (typeof cel.duracion === 'string' && cel.duracion.includes(':')) {
            const parts = cel.duracion.split(':').map(Number);
            if (parts.length === 3) {
              durSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
              durSec = parts[0] * 60 + parts[1];
            }
          } else {
            durSec = Number(cel.duracion || 0);
          }

          let fechaBase = cel.fecha || '';
          if (fechaBase.includes('T')) {
            fechaBase = fechaBase.slice(0, 10);
          }
          cel.fecha = fechaBase;

          const fechaInicio =
            fechaBase && cel.hora
              ? `${fechaBase}T${cel.hora}`
              : cel.created_at || new Date().toISOString();

          const asesor =
            cel.asesor_nombre ||
            resolverAsesor(cel.usuario || '', resolverAsesor(cel.linea || '', cel.usuario || 'Ejecutivo Celular'));
          cel.asesor_nombre = asesor;

          llamadas.push({
            id: String(cel.id || `cel-${idx}`),
            vendedor_id: asesor.toLowerCase().replace(/\s+/g, '_'),
            vendedor_nombre: asesor,
            telefono_marcado: String(cel.destino || '').trim(),
            fecha_hora_inicio: fechaInicio,
            fecha_hora_fin: fechaInicio,
            duracion_segundos: durSec,
            resultado: durSec > 0 || cel.tipo === 'Saliente' ? 'contestada' : 'no_contesta',
            proveedor: 'Twilio',
            canal_tipo: 'Celular',
            notas_llamada: `[Celular] Operador: ${cel.operador || 'N/D'} | Línea: ${cel.linea || 'Móvil'}`,
          });
        });

        // C. Teams
        llamadasTeams.forEach((tm: any, idx: number) => {
          const fechaInicio =
            tm.fecha_reunion && tm.hora_reunion
              ? `${tm.fecha_reunion}T${tm.hora_reunion}`
              : tm.created_at || new Date().toISOString();

          const asesor = tm.ejecutivo_nombre || tm.ejecutivo || 'Ejecutivo Teams';
          tm.ejecutivo_nombre = asesor;

          llamadas.push({
            id: String(tm.id || `teams-${idx}`),
            vendedor_id: asesor.toLowerCase().replace(/\s+/g, '_'),
            vendedor_nombre: asesor,
            telefono_marcado: String(tm.codigo_prospecto || '').trim(),
            prospecto_nombre: tm.cliente || undefined,
            fecha_hora_inicio: fechaInicio,
            fecha_hora_fin: fechaInicio,
            duracion_segundos: 1800,
            resultado: 'contestada',
            proveedor: 'RingCentral',
            canal_tipo: 'Teams',
            grabacion_url: tm.evidencia_url || undefined,
            notas_llamada: `[Teams] Estado: ${tm.estado_teams || 'Completada'}`,
          });
        });

        // D. WhatsApp
        llamadasWhatsapp.forEach((wa: any, idx: number) => {
          const durSec = Number(wa.duracion_segundos || 45);
          const fechaInicio = wa.fecha_llamada || wa.created_at || new Date().toISOString();

          const asesor =
            wa.asesor_nombre ||
            resolverAsesor(
              String(wa.ejecutivo_id || ''),
              resolverAsesor(wa.numero_ejecutivo || '', 'Asesor WhatsApp')
            );
          wa.asesor_nombre = asesor;

          llamadas.push({
            id: String(wa.id || `wa-${idx}`),
            vendedor_id: asesor.toLowerCase().replace(/\s+/g, '_'),
            vendedor_nombre: asesor,
            telefono_marcado: String(wa.numero_cliente || '').trim(),
            fecha_hora_inicio: fechaInicio,
            fecha_hora_fin: fechaInicio,
            duracion_segundos: durSec,
            resultado: wa.estado?.toLowerCase() === 'contestada' ? 'contestada' : 'no_contesta',
            proveedor: 'Vapi',
            canal_tipo: 'WhatsApp',
            notas_llamada: `[WhatsApp] Dirección: ${wa.direccion || 'Saliente'}`,
          });
        });

        const fin = performance.now();
        return {
          citasCalificadas,
          citasNoCalificadas,
          citas: citasCalificadas,
          llamadas,
          catalogo,
          rawPbx: llamadasPbx,
          rawCelular: llamadasCelular,
          rawWhatsapp: llamadasWhatsapp,
          rawLeads: leads,
          rawLeadsNoCalificados: leadsNoCalificados,
          rawTeams: llamadasTeams,
          estadisticas: json.estadisticas || {},
          diagnostico: json.diagnostico || null,
          rango: json.rango || { desde, hasta },
          tiempo_ms: Math.round(fin - inicio),
        };
      }
    }
  } catch (err) {
    console.error('Error al consultar /api/sync/datos-completos en caliente:', err);
  }

  return {
    citasCalificadas: [],
    citasNoCalificadas: [],
    citas: [],
    llamadas: [],
    catalogo: [],
    rawPbx: [],
    rawCelular: [],
    rawWhatsapp: [],
    rawLeads: [],
    rawLeadsNoCalificados: [],
    rawTeams: [],
    estadisticas: {},
    rango: { desde, hasta },
    tiempo_ms: Math.round(performance.now() - inicio),
  };
}

/**
 * Guarda cambios en un lead (SLA / Retroalimentación) en el Backend
 */
export async function actualizarLeadKpiBackend(
  leadId: string,
  cambios: Partial<Cita>,
  tabla: 'leads' | 'leads_no_calificados' = 'leads',
  citaCompleta?: Partial<Cita>
): Promise<boolean> {
  try {
    const payload = { ...(citaCompleta || {}), ...cambios };
    const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}?tabla=${tabla}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error al actualizar lead KPI en backend:', err);
    return false;
  }
}

export async function guardarCatalogoItemBackend(item: any): Promise<boolean> {
  try {
    const method = item.id ? 'PATCH' : 'POST';
    const url = item.id ? `/api/catalogo/${item.id}` : '/api/catalogo';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.ok;
  } catch (err) {
    console.warn('Error en backend para catálogo:', err);
    return false;
  }
}

export async function guardarReunionTeamsBackend(reunion: any): Promise<boolean> {
  try {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reunion),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.exito);
    }
  } catch (err) {
    console.warn('Error al guardar Teams en backend:', err);
  }
  return false;
}

export async function eliminarCatalogoItemBackend(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/catalogo/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    console.warn('Error al eliminar catálogo en backend:', err);
    return false;
  }
}

export async function guardarLlamadaManualBackend(
  tipo: 'pbx' | 'celular',
  datos: any
): Promise<{ exito: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`/api/llamadas/${tipo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.exito) return json;
    }
  } catch (e) {
    console.warn(`Error al enviar llamada manual a /api/llamadas/${tipo}:`, e);
  }

  return { exito: false, error: 'No se pudo guardar la llamada manual.' };
}
