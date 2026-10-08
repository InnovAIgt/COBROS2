import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;

// ============================================================================
// CONFIGURACIÓN CENTRALIZADA EN EL BACKEND (Extraída de la antigua Edge Function)
// Sin usar process.env para evitar que la plataforma pida "Secrets" al usuario.
// ============================================================================
const BACKEND_CONFIG = {
  redPbxHost: 'https://api.red.com.sv',
  pbxLoginEndpoint: '/login',
  pbxCallsEndpoint: '/pbx/api/v1/getCalls2',
  pbxUsername: 'DMONGE',
  pbxPassword: '*Sunfl0wer*',

  prospektiaHost: 'https://prospektia.red.com.sv',
  prospektiaCalificadosEndpoint: '/api/external/leads-calificados',
  prospektiaNoCalificadosEndpoint: '/api/audit/leads-no-calificados',
  prospektiaApiKey: 'RedApi_2026_SuperSegura_9XK2',

  celularApiUrl: 'https://kpi.red.com.sv/api/historial-llamadas-ejecutivos',
  celularApiKey: 'mso_papi_2026_7f2b9c4d8e6a1b3f5d7c9e0a2b4c6d8f',

  supabaseUrl: 'https://sbopifiiyezmvsadwkpg.supabase.co',
  supabaseKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNib3BpZmlpeWV6bXZzYWR3a3BnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzM0Nzk3MCwiZXhwIjoyMDg4OTIzOTcwfQ.am21N9d-B6-2w4B3v2T2lN8C-q6K1wTw8A6yB5x1vYc',
};

// ============================================================================
// ALMACÉN LOCAL DEL BACKEND (Catálogo, Teams, WhatsApp, Checks KPI y Manuales)
// ============================================================================
const STORE_PATH = path.resolve(process.cwd(), 'data', 'backendStore.json');

const CATALOGO_OFICIAL_INICIAL = [
  { id: 1, pais: 'GT', nombre_ejecutivo: 'Alexandra Alondono', usuario: 'ALONDONO', extension: null, celular: null },
  { id: 2, pais: 'SV', nombre_ejecutivo: 'Anyelo Hernández', usuario: 'AHERNANDEZ', extension: '4057', celular: '7981 0573' },
  { id: 3, pais: 'SV', nombre_ejecutivo: 'Esau Vides', usuario: 'EEVIDES', extension: '4056', celular: '7737 7963' },
  { id: 4, pais: 'GT', nombre_ejecutivo: 'Lucia Conde', usuario: 'SCONDE', extension: '6052', celular: '3769 4011' },
  { id: 5, pais: 'GT', nombre_ejecutivo: 'Mabel Flores', usuario: 'JFLORES', extension: '6051', celular: '3995 9818' },
  { id: 6, pais: 'SV', nombre_ejecutivo: 'Mario Ceron', usuario: 'MCERON', extension: '4059', celular: '7981 1670' },
  { id: 7, pais: 'SV', nombre_ejecutivo: 'Mauricio Kreitz', usuario: 'CKREITZ', extension: '4053', celular: '7980 0042' },
  { id: 8, pais: 'SV', nombre_ejecutivo: 'Obed Hernandez', usuario: 'OHERNANDEZ', extension: '6060', celular: '3769 0057' },
  { id: 10, pais: 'SV', nombre_ejecutivo: 'Pedro Aguilar', usuario: 'PAGUILAR', extension: '4122', celular: '79829288' },
  { id: 11, pais: 'GT', nombre_ejecutivo: 'Gabriela Herrera', usuario: 'GHERRERA', extension: '6056', celular: '34837796' },
  { id: 12, pais: 'GT', nombre_ejecutivo: 'Pablo Paniagua', usuario: 'PPANIAGUA', extension: '6054', celular: '34847796' },
  { id: 13, pais: 'GT', nombre_ejecutivo: 'Chelsea Fuentes', usuario: 'RFUENTES', extension: '6077', celular: '37561547' },
];

interface BackendStoreData {
  catalogo: any[];
  llamadasTeams: any[];
  llamadasWhatsapp: any[];
  kpiLeads: Record<string, any>;
  kpiNoCalificados: Record<string, any>;
  llamadasPbxManuales: any[];
  llamadasCelularManuales: any[];
}

function leerBackendStore(): BackendStoreData {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        catalogo: Array.isArray(parsed.catalogo) && parsed.catalogo.length > 0 ? parsed.catalogo : CATALOGO_OFICIAL_INICIAL,
        llamadasTeams: Array.isArray(parsed.llamadasTeams) ? parsed.llamadasTeams : [],
        llamadasWhatsapp: Array.isArray(parsed.llamadasWhatsapp) ? parsed.llamadasWhatsapp : [],
        kpiLeads: parsed.kpiLeads && typeof parsed.kpiLeads === 'object' ? parsed.kpiLeads : {},
        kpiNoCalificados: parsed.kpiNoCalificados && typeof parsed.kpiNoCalificados === 'object' ? parsed.kpiNoCalificados : {},
        llamadasPbxManuales: Array.isArray(parsed.llamadasPbxManuales) ? parsed.llamadasPbxManuales : [],
        llamadasCelularManuales: Array.isArray(parsed.llamadasCelularManuales) ? parsed.llamadasCelularManuales : [],
      };
    }
  } catch (err) {
    console.warn('Error leyendo data/backendStore.json, usando valores iniciales:', err);
  }
  return {
    catalogo: [...CATALOGO_OFICIAL_INICIAL],
    llamadasTeams: [],
    llamadasWhatsapp: [],
    kpiLeads: {},
    kpiNoCalificados: {},
    llamadasPbxManuales: [],
    llamadasCelularManuales: [],
  };
}

function guardarBackendStore(store: BackendStoreData): void {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error guardando data/backendStore.json:', err);
  }
}

// Caché en memoria del token JWT de PBX para acelerar consultas consecutivas
let cachedPbxToken: string = '';
let cachedPbxTokenExpiresAt: number = 0;

/**
 * Calcula dinámicamente el rango del mes actual a partir de la fecha del sistema (sin fechas quemadas)
 */
function calcularRangoMesActualDinamico(): { desde: string; hasta: string; hoy: string } {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = ahora.getMonth();
  const day = ahora.getDate();
  const ultimoDia = new Date(year, month + 1, 0).getDate();

  const mm = String(month + 1).padStart(2, '0');
  const ddHoy = String(day).padStart(2, '0');
  const ddFin = String(ultimoDia).padStart(2, '0');

  return {
    desde: `${year}-${mm}-01`,
    hasta: `${year}-${mm}-${ddFin}`,
    hoy: `${year}-${mm}-${ddHoy}`,
  };
}

/**
 * Construye el resolvedor de asesores en base al Catálogo del Backend
 */
function construirResolvedorCatalogo(catalogo: any[]) {
  const mapaCatalogo = {
    porExtension: {} as Record<string, any>,
    porUsuario: {} as Record<string, any>,
    porCelular: {} as Record<string, any>,
    porNombre: {} as Record<string, any>,
  };

  catalogo.forEach((cat: any) => {
    if (cat.extension && cat.extension !== 'null') {
      mapaCatalogo.porExtension[String(cat.extension).trim()] = cat;
    }
    if (cat.usuario && cat.usuario !== 'null') {
      mapaCatalogo.porUsuario[String(cat.usuario).trim().toLowerCase()] = cat;
    }
    if (cat.nombre_ejecutivo) {
      mapaCatalogo.porNombre[String(cat.nombre_ejecutivo).trim().toLowerCase()] = cat;
    }
    if (cat.celular && cat.celular !== 'null') {
      const cleanTel = String(cat.celular).replace(/[^0-9]/g, '').slice(-8);
      if (cleanTel) mapaCatalogo.porCelular[cleanTel] = cat;
    }
  });

  const resolverAsesor = (ident: any, fallback: string): string => {
    if (!ident || ident === 'null' || ident === 'undefined') return fallback;
    const idTrim = String(ident).trim();
    const idLower = idTrim.toLowerCase();

    if (mapaCatalogo.porUsuario[idLower]) return mapaCatalogo.porUsuario[idLower].nombre_ejecutivo;
    if (mapaCatalogo.porExtension[idTrim]) return mapaCatalogo.porExtension[idTrim].nombre_ejecutivo;
    if (mapaCatalogo.porNombre[idLower]) return mapaCatalogo.porNombre[idLower].nombre_ejecutivo;

    const cleanDigits = idTrim.replace(/[^0-9]/g, '').slice(-8);
    if (cleanDigits && mapaCatalogo.porCelular[cleanDigits]) {
      return mapaCatalogo.porCelular[cleanDigits].nombre_ejecutivo;
    }

    for (const cat of catalogo) {
      if (cat.usuario && idLower.includes(String(cat.usuario).toLowerCase())) {
        return cat.nombre_ejecutivo;
      }
      if (cat.nombre_ejecutivo && idLower.includes(String(cat.nombre_ejecutivo).toLowerCase())) {
        return cat.nombre_ejecutivo;
      }
    }
    return fallback;
  };

  return { mapaCatalogo, resolverAsesor };
}

function detectarPaisPorTelefono(tel?: string, fallback = 'SV'): string {
  if (!tel) return fallback;
  const num = String(tel).replace(/[^0-9]/g, '');
  if (num.startsWith('503')) return 'SV';
  if (num.startsWith('502')) return 'GT';
  if (num.length === 8) {
    if (['2', '6', '7'].includes(num[0])) return 'SV';
    if (['3', '4', '5'].includes(num[0])) return 'GT';
  }
  return fallback;
}

/**
 * Obtiene el token JWT autenticándose contra https://api.red.com.sv/login con DMONGE / *Sunfl0wer*
 */
async function obtenerJwtPbx(forceRefresh = false): Promise<{ token: string; ok: boolean; error?: string }> {
  const ahoraMs = Date.now();
  if (!forceRefresh && cachedPbxToken && ahoraMs < cachedPbxTokenExpiresAt) {
    return { token: cachedPbxToken, ok: true };
  }

  try {
    const res = await fetch(`${BACKEND_CONFIG.redPbxHost}${BACKEND_CONFIG.pbxLoginEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: BACKEND_CONFIG.pbxUsername,
        password: BACKEND_CONFIG.pbxPassword,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { token: '', ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }

    const data: any = await res.json();
    const token = data?.token || data?.access_token || data?.jwt || data?.data?.token || '';
    if (token) {
      cachedPbxToken = token;
      cachedPbxTokenExpiresAt = ahoraMs + 40 * 60 * 1000;
      return { token, ok: true };
    }
    return { token: '', ok: false, error: 'Respuesta de login PBX no incluyó token' };
  } catch (err: any) {
    return { token: '', ok: false, error: err?.message || String(err) };
  }
}

/**
 * Divide un rango [desde, hasta] en ventanas de hasta 15 días para consultar getCalls2 en paralelo sin timeout
 */
function generarVentanasPbx(desde: string, hasta: string, maxDias = 15): Array<{ desde: string; hasta: string }> {
  const inicio = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || inicio > fin) {
    return [{ desde, hasta }];
  }

  const ventanas: Array<{ desde: string; hasta: string }> = [];
  let cursor = new Date(inicio);

  while (cursor <= fin) {
    const ventanaInicio = new Date(cursor);
    const ventanaFin = new Date(cursor);
    ventanaFin.setUTCDate(ventanaInicio.getUTCDate() + maxDias - 1);
    const rangoHasta = ventanaFin > fin ? new Date(fin) : ventanaFin;

    ventanas.push({
      desde: ventanaInicio.toISOString().slice(0, 10),
      hasta: rangoHasta.toISOString().slice(0, 10),
    });

    cursor = new Date(rangoHasta);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return ventanas;
}

function hashAUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function extraerRegistros(responseData: any): any[] {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData;
  if (typeof responseData !== 'object') return [];
  const posiblesClaves = ['leads', 'items', 'data', 'info', 'records', 'registros', 'rows', 'calls', 'llamadas'];
  for (const clave of posiblesClaves) {
    if (Array.isArray(responseData[clave])) return responseData[clave];
  }
  for (const clave of Object.keys(responseData)) {
    if (Array.isArray(responseData[clave])) return responseData[clave];
  }
  return [];
}

function normalizarFechaHoraPbx(rawFecha: any, rawHora?: any): string | null {
  if (!rawFecha) return null;
  const s = String(rawFecha).trim();
  if (!s || s === 'null' || s === 'undefined') return null;

  if (s.includes('T')) {
    return s.replace(/\.000Z$/, '');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const h = rawHora ? String(rawHora).trim() : '00:00:00';
    return `${s}T${h.length === 5 ? h + ':00' : h}`;
  }
  return s;
}

function normalizarCallRowPbx(registro: any, defaultPais: string = 'SV'): any {
  const fechaRaw =
    registro.FECHA ||
    registro.fecha ||
    registro.FECHA_HORA ||
    registro.fecha_hora ||
    registro.SOLO_FECHA ||
    registro.solo_fecha ||
    null;
  const horaRaw = registro.HORA || registro.hora || registro.HORA_LLAMADA || registro.hora_llamada || null;
  const fechaHora = normalizarFechaHoraPbx(fechaRaw, horaRaw);
  const soloFecha =
    (registro.SOLO_FECHA ? String(registro.SOLO_FECHA).slice(0, 10) : null) ||
    (registro.solo_fecha ? String(registro.solo_fecha).slice(0, 10) : null) ||
    (fechaHora ? String(fechaHora).slice(0, 10) : null);

  const rawExtension = registro.EXTENSION ?? registro.extension ?? registro.usuario ?? '';
  const extensionLimpia = String(rawExtension).trim().replace(/[^0-9]/g, '');
  const paisDetectado = String(
    registro.PAIS || registro.pais || registro.country || defaultPais
  ).toUpperCase();

  const durSec = Number(
    registro.DURATION_SEC ??
      registro.duration_sec ??
      registro.duracion_segundos ??
      (registro.DURACION_MINUTOS ? Number(registro.DURACION_MINUTOS) * 60 : 0)
  );

  const rawUnique = registro.uniqueid || registro.UNIQUEID || registro.id || '';
  const uniqueid = rawUnique
    ? `${paisDetectado}_${String(rawUnique).trim()}`
    : `pbx_${paisDetectado}_${extensionLimpia}_${registro.DESTINO || registro.destino || ''}_${fechaHora || ''}`;

  const rawAudio = registro.audio_url || registro.grabacion_url || null;
  const proxyAudioUrl = rawAudio
    ? `/api/pbx/audio?url=${encodeURIComponent(String(rawAudio).trim())}`
    : null;

  return {
    id: registro.id || hashAUuid(uniqueid),
    uniqueid,
    nombre: registro.NOMBRE || registro.nombre || null,
    extension: extensionLimpia || String(rawExtension).trim() || null,
    prefijo: registro.PREFIJO ?? registro.prefijo ?? null,
    destino: String(registro.DESTINO || registro.destino || '').trim() || null,
    duracion_minutos: registro.DURACION_MINUTOS || registro.duracion_minutos || Math.round((durSec / 60) * 100) / 100,
    duracion_segundos: durSec,
    duracion_hh_mm_ss: registro.DURACION_HH_MM_SS || registro.duracion_hh_mm_ss || null,
    estado: registro.ESTADO || registro.estado || null,
    fecha_hora: fechaHora,
    fecha: soloFecha,
    solo_fecha: soloFecha,
    anio: registro.ANIO ?? registro.anio ?? (soloFecha ? Number(soloFecha.slice(0, 4)) : null),
    mes: registro.MES ?? registro.mes ?? (soloFecha ? Number(soloFecha.slice(5, 7)) : null),
    dia: registro.DIA ?? registro.dia ?? (soloFecha ? Number(soloFecha.slice(8, 10)) : null),
    pais: paisDetectado,
    fuente_llamada: 'PBX',
    audio_url: proxyAudioUrl,
    grabacion_url: proxyAudioUrl,
    raw_audio_url: rawAudio,
  };
}

function normalizarLeadCalificado(registro: any, kpiLeads: Record<string, any>): any {
  const codigo = String(registro.codigo_prospecto || registro.id || '').trim();
  const idGenerado = registro.id || hashAUuid(`lead_${codigo}`);
  const savedKpi = kpiLeads[codigo] || kpiLeads[idGenerado] || {};

  const fAg =
    registro.fecha_agendada && registro.fecha_agendada !== 'null'
      ? String(registro.fecha_agendada).trim().slice(0, 10)
      : null;
  const hAg =
    registro.hora_agendada && registro.hora_agendada !== 'null'
      ? String(registro.hora_agendada).trim()
      : null;
  const fCr =
    registro.fecha_creado && registro.fecha_creado !== 'null'
      ? String(registro.fecha_creado).trim().slice(0, 10)
      : null;
  const hCr =
    registro.hora_creado && registro.hora_creado !== 'null'
      ? String(registro.hora_creado).trim()
      : null;

  let createdAt = registro.created_at;
  if (!createdAt && fCr) {
    createdAt = hCr ? `${fCr}T${hCr}Z` : `${fCr}T00:00:00Z`;
  }

  const tel = String(registro.telefono || registro.celular || '').trim();

  return {
    id: savedKpi.id || idGenerado,
    codigo_prospecto: codigo,
    nombre_prospecto:
      String(registro.nombre_prospecto || registro.nombre || '').trim() ||
      (codigo ? `Prospecto ${codigo}` : 'Prospecto Sin Nombre'),
    telefono: tel,
    fecha_agendada: fAg,
    hora_agendada: hAg,
    fecha_creado: fCr,
    hora_creado: hCr,
    tipo_reunion: registro.tipo_reunion || 'Llamada Telefonica',
    pais: String(registro.pais || detectarPaisPorTelefono(tel, 'SV')).toUpperCase(),
    asesor_id: registro.asesor_id != null ? String(registro.asesor_id) : null,
    asesor_nombre: String(registro.asesor_nombre || registro.ejecutivo || '').trim() || null,
    asesor_email: registro.asesor_email || registro.email || null,
    status: registro.status || 'Agendado',
    created_at: createdAt,
    propuesta_observaciones: registro.propuesta_observaciones || null,
    kpi_sla_etapa_1: Boolean(savedKpi.kpi_sla_etapa_1 ?? registro.kpi_sla_etapa_1 ?? false),
    kpi_sla_etapa_2: Boolean(savedKpi.kpi_sla_etapa_2 ?? registro.kpi_sla_etapa_2 ?? false),
    kpi_sla_etapa_3: Boolean(savedKpi.kpi_sla_etapa_3 ?? registro.kpi_sla_etapa_3 ?? false),
    kpi_retroalimentacion_etapa_1: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_1 ?? registro.kpi_retroalimentacion_etapa_1 ?? false
    ),
    kpi_retroalimentacion_etapa_2: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_2 ?? registro.kpi_retroalimentacion_etapa_2 ?? false
    ),
    kpi_retroalimentacion_etapa_3: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_3 ?? registro.kpi_retroalimentacion_etapa_3 ?? false
    ),
    kpi_retroalimentacion_etapa_4: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_4 ?? registro.kpi_retroalimentacion_etapa_4 ?? false
    ),
  };
}

function normalizarLeadNoCalificado(registro: any, kpiNoCalificados: Record<string, any>): any {
  const telefonoRaw =
    registro?.client_phone ??
    registro?.telefono ??
    registro?.phone ??
    registro?.phone_number ??
    '';
  const telefono = String(telefonoRaw === 'null' ? '' : telefonoRaw).trim();
  const clientId = String(registro?.client_id || registro?.lead_id || '').trim();
  const createdAtSv = String(registro?.created_at_sv || '').trim();

  const seed = `${clientId}_${createdAtSv}_${telefono}`;
  const idGenerado = registro?.id || hashAUuid(seed);
  const savedKpi = kpiNoCalificados[clientId] || kpiNoCalificados[idGenerado] || {};

  let fecha = '';
  let hora = '09:00:00';
  let createdAt = registro?.created_at || '';

  if (createdAtSv) {
    const match = createdAtSv.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      const [, dd, mm, yyyy, hh, min, ampm] = match;
      let hourNum = parseInt(hh, 10);
      if (ampm?.toUpperCase() === 'PM' && hourNum < 12) hourNum += 12;
      if (ampm?.toUpperCase() === 'AM' && hourNum === 12) hourNum = 0;
      fecha = `${yyyy}-${String(parseInt(mm, 10)).padStart(2, '0')}-${String(parseInt(dd, 10)).padStart(2, '0')}`;
      hora = `${String(hourNum).padStart(2, '0')}:${min}:00`;
      if (!createdAt) {
        createdAt = `${fecha}T${hora}Z`;
      }
    }
  }

  if (!fecha && createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      const sv = new Date(d.getTime() - 6 * 3600 * 1000);
      fecha = sv.toISOString().slice(0, 10);
      hora = sv.toISOString().slice(11, 19);
    }
  }

  const paisInferido = detectarPaisPorTelefono(telefono, 'SV');

  return {
    id: savedKpi.id || idGenerado,
    client_id: clientId,
    client_name: String(registro?.client_name || registro?.nombre || '').trim(),
    advisor_name: String(registro?.advisor_name || registro?.ejecutivo || '').trim(),
    campaign_name: registro?.campaign_name || 'Campaña Inbound',
    telefono,
    pais: registro?.pais || registro?.country || paisInferido,
    fecha,
    hora,
    created_at: createdAt,
    created_at_sv: createdAtSv || null,
    updated_at: registro?.updated_at || createdAt,
    kpi_sla_etapa_1: Boolean(savedKpi.kpi_sla_etapa_1 ?? registro.kpi_sla_etapa_1 ?? false),
    kpi_sla_etapa_2: Boolean(savedKpi.kpi_sla_etapa_2 ?? registro.kpi_sla_etapa_2 ?? false),
    kpi_sla_etapa_3: Boolean(savedKpi.kpi_sla_etapa_3 ?? registro.kpi_sla_etapa_3 ?? false),
    kpi_retroalimentacion_etapa_1: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_1 ?? registro.kpi_retroalimentacion_etapa_1 ?? false
    ),
    kpi_retroalimentacion_etapa_2: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_2 ?? registro.kpi_retroalimentacion_etapa_2 ?? false
    ),
    kpi_retroalimentacion_etapa_3: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_3 ?? registro.kpi_retroalimentacion_etapa_3 ?? false
    ),
    kpi_retroalimentacion_etapa_4: Boolean(
      savedKpi.kpi_retroalimentacion_etapa_4 ?? registro.kpi_retroalimentacion_etapa_4 ?? false
    ),
  };
}

/**
 * 1. Consulta en caliente a Prospektia Leads Calificados estrictamente para el rango [desde, hasta]
 * (Por defecto: Mes Actual dinámico).
 */
async function consultarLeadsCalificadosEnCaliente(params: {
  desde: string;
  hasta: string;
  pais?: string;
  asesor?: string;
  tipo_reunion?: string;
  kpiLeads: Record<string, any>;
}): Promise<{ data: any[]; metadata: any; ok: boolean; error?: string }> {
  try {
    const qs = new URLSearchParams();
    if (params.desde) qs.set('desde', params.desde);
    if (params.hasta) qs.set('hasta', params.hasta);
    if (params.pais && params.pais !== 'AMBOS' && params.pais !== 'TODOS') {
      qs.set('pais', params.pais.toLowerCase());
    }
    if (params.asesor) qs.set('asesor', params.asesor);
    if (params.tipo_reunion) qs.set('tipo_reunion', params.tipo_reunion);
    qs.set('limite', '1000');

    const url = `${BACKEND_CONFIG.prospektiaHost}${BACKEND_CONFIG.prospektiaCalificadosEndpoint}?${qs.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': BACKEND_CONFIG.prospektiaApiKey, Accept: 'application/json' },
    });

    if (!res.ok) {
      return { data: [], metadata: null, ok: false, error: `HTTP ${res.status}` };
    }

    const json: any = await res.json();
    const rawLeads = extraerRegistros(json);

    const mapUnicos = new Map<string, any>();
    for (const item of rawLeads) {
      const norm = normalizarLeadCalificado(item, params.kpiLeads);
      const fRef = norm.fecha_agendada || norm.fecha_creado || '';
      if (params.desde && fRef && fRef < params.desde) continue;
      if (params.hasta && fRef && fRef > params.hasta) continue;
      if (norm.codigo_prospecto) {
        mapUnicos.set(norm.codigo_prospecto, norm);
      }
    }

    return {
      data: Array.from(mapUnicos.values()),
      metadata: json?.metadata || null,
      ok: true,
    };
  } catch (err: any) {
    return { data: [], metadata: null, ok: false, error: err?.message || String(err) };
  }
}

/**
 * 2. Consulta en caliente a Prospektia Leads No Calificados filtrando estrictamente por rango [desde, hasta]
 * (Por defecto: Mes Actual dinámico).
 */
async function consultarLeadsNoCalificadosEnCaliente(params: {
  desde: string;
  hasta: string;
  pais?: string;
  kpiNoCalificados: Record<string, any>;
}): Promise<{ data: any[]; ok: boolean; error?: string }> {
  try {
    const todosRaw: any[] = [];
    const limit = 1000;
    let offset = 0;
    const maxPaginas = 2;

    for (let p = 0; p < maxPaginas; p++) {
      const qs = new URLSearchParams();
      qs.set('limit', String(limit));
      qs.set('offset', String(offset));

      const url = `${BACKEND_CONFIG.prospektiaHost}${BACKEND_CONFIG.prospektiaNoCalificadosEndpoint}?${qs.toString()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-API-Key': BACKEND_CONFIG.prospektiaApiKey, Accept: 'application/json' },
      });

      if (!res.ok) break;
      const json: any = await res.json();
      const items = extraerRegistros(json);
      if (!items || items.length === 0) break;

      todosRaw.push(...items);
      if (items.length < limit) break;
      offset += limit;
    }

    const normalizados: any[] = [];
    for (const raw of todosRaw) {
      const norm = normalizarLeadNoCalificado(raw, params.kpiNoCalificados);
      if (
        params.pais &&
        params.pais !== 'AMBOS' &&
        params.pais !== 'TODOS' &&
        norm.pais.toUpperCase() !== params.pais.toUpperCase()
      ) {
        continue;
      }
      normalizados.push(norm);
    }

    // Filtrar estrictamente por el rango [desde, hasta]
    const enRango = normalizados.filter((norm) => {
      if (params.desde && norm.fecha && norm.fecha < params.desde) return false;
      if (params.hasta && norm.fecha && norm.fecha > params.hasta) return false;
      return true;
    });

    const mapUnicos = new Map<string, any>();
    for (const norm of enRango) {
      mapUnicos.set(norm.client_id || norm.id, norm);
    }

    return {
      data: Array.from(mapUnicos.values()),
      ok: true,
    };
  } catch (err: any) {
    return { data: [], ok: false, error: err?.message || String(err) };
  }
}

/**
 * 3. Consulta en caliente a PBX (getCalls2) autenticando con DMONGE / *Sunfl0wer*
 */
async function consultarPbxEnCaliente(params: {
  desde: string;
  hasta: string;
  hoy: string;
  pais?: string;
}): Promise<{ data: any[]; ok: boolean; error?: string }> {
  try {
    const hastaEfectivo = params.hasta > params.hoy && params.desde <= params.hoy ? params.hoy : params.hasta;

    let auth = await obtenerJwtPbx(false);
    if (!auth.ok || !auth.token) {
      auth = await obtenerJwtPbx(true);
    }
    if (!auth.ok || !auth.token) {
      return { data: [], ok: false, error: auth.error || 'No se pudo obtener token PBX' };
    }

    const paisUpper = params.pais ? params.pais.toUpperCase() : 'AMBOS';
    const paises = paisUpper === 'SV' ? ['SV'] : paisUpper === 'GT' ? ['GT'] : ['SV', 'GT'];
    const ventanas = generarVentanasPbx(params.desde, hastaEfectivo, 15);

    const ejecutarPeticiones = async (token: string) => {
      const promesas: Array<Promise<{ status: number; items: any[]; pais: string }>> = [];
      for (const pais of paises) {
        for (const v of ventanas) {
          const url = `${BACKEND_CONFIG.redPbxHost}${BACKEND_CONFIG.pbxCallsEndpoint}?desde=${v.desde}&hasta=${v.hasta}&pais=${pais}`;
          promesas.push(
            fetch(url, {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            })
              .then(async (r) => {
                if (!r.ok) return { status: r.status, items: [], pais };
                const json = await r.json();
                return { status: r.status, items: extraerRegistros(json), pais };
              })
              .catch(() => ({ status: 500, items: [], pais }))
          );
        }
      }
      return Promise.all(promesas);
    };

    let resultados = await ejecutarPeticiones(auth.token);
    if (resultados.some((r) => r.status === 401)) {
      const nuevoAuth = await obtenerJwtPbx(true);
      if (nuevoAuth.ok && nuevoAuth.token) {
        resultados = await ejecutarPeticiones(nuevoAuth.token);
      }
    }

    const mapUnicos = new Map<string, any>();
    for (const bloque of resultados) {
      for (const raw of bloque.items) {
        const norm = normalizarCallRowPbx(raw, bloque.pais);
        const f = norm.fecha || (norm.fecha_hora ? String(norm.fecha_hora).slice(0, 10) : '');
        if (params.desde && f && f < params.desde) continue;
        if (params.hasta && f && f > params.hasta) continue;
        mapUnicos.set(norm.uniqueid, norm);
      }
    }

    const listaOrdenada = Array.from(mapUnicos.values()).sort((a, b) =>
      String(b.fecha_hora || '').localeCompare(String(a.fecha_hora || ''))
    );

    return { data: listaOrdenada, ok: true };
  } catch (err: any) {
    return { data: [], ok: false, error: err?.message || String(err) };
  }
}

/**
 * 4. Consulta en caliente a Llamadas de Celular (historial-llamadas-ejecutivos)
 */
async function consultarCelularEnCaliente(params: {
  desde: string;
  hasta: string;
}): Promise<{ data: any[]; ok: boolean; error?: string }> {
  try {
    const qs = new URLSearchParams();
    if (params.desde) qs.set('desde', params.desde);
    if (params.hasta) qs.set('hasta', params.hasta);

    const url = `${BACKEND_CONFIG.celularApiUrl}?${qs.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-KEY': BACKEND_CONFIG.celularApiKey, Accept: 'application/json' },
    });

    if (!res.ok) {
      return { data: [], ok: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    const registros = extraerRegistros(json);

    const mapUnicos = new Map<string, any>();
    for (const item of registros) {
      const f = item.fecha
        ? String(item.fecha).slice(0, 10)
        : item.dia_consultado
        ? String(item.dia_consultado).slice(0, 10)
        : '';

      if (params.desde && f && f < params.desde) continue;
      if (params.hasta && f && f > params.hasta) continue;

      const key = String(item.id || `${f}_${item.hora}_${item.destino}_${item.usuario}`);
      mapUnicos.set(key, {
        ...item,
        fecha: f || item.fecha,
        operador: item.operador || 'Claro / Tigo',
      });
    }

    const listaOrdenada = Array.from(mapUnicos.values()).sort((a, b) => {
      const fa = `${a.fecha || ''}T${a.hora || '00:00:00'}`;
      const fb = `${b.fecha || ''}T${b.hora || '00:00:00'}`;
      return fb.localeCompare(fa);
    });

    return { data: listaOrdenada, ok: true };
  } catch (err: any) {
    return { data: [], ok: false, error: err?.message || String(err) };
  }
}

/**
 * 5. Consulta llamadas de WhatsApp desde Supabase (public.llamadas_whatsapp), sin restringir al mes actual salvo filtro
 */
async function consultarWhatsappDesdeSupabase(fallbackList: any[]): Promise<{ data: any[]; ok: boolean }> {
  try {
    const res = await fetch(
      `${BACKEND_CONFIG.supabaseUrl}/rest/v1/llamadas_whatsapp?select=*&order=fecha_llamada.desc&limit=2000`,
      {
        headers: {
          apikey: BACKEND_CONFIG.supabaseKey,
          Authorization: `Bearer ${BACKEND_CONFIG.supabaseKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { data, ok: true };
      }
    }
  } catch (_e) {
    // Fallback al almacén local si hay intermitencia de red
  }
  return { data: fallbackList, ok: true };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  /**
   * ENDPOINT PRINCIPAL DE CONSULTA EN CALIENTE (100% BACKEND PROPIO - CERO SUPABASE)
   * Por defecto consulta el mes actual en todas las APIs externas.
   * Si se pasa ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD, consulta ese rango en caliente.
   */
  app.get('/api/sync/datos-completos', async (req, res) => {
    const inicioMs = Date.now();
    try {
      const rangoDefault = calcularRangoMesActualDinamico();
      const qDesde =
        typeof req.query.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde)
          ? req.query.desde
          : rangoDefault.desde;
      const qHasta =
        typeof req.query.hasta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta)
          ? req.query.hasta
          : rangoDefault.hasta;
      const qPais = typeof req.query.pais === 'string' ? req.query.pais : undefined;
      const qAsesor = typeof req.query.asesor === 'string' ? req.query.asesor : undefined;
      const qTipoReunion = typeof req.query.tipo_reunion === 'string' ? req.query.tipo_reunion : undefined;

      // 1. Leer almacén local del backend (Catálogo, Teams, WhatsApp, Checks KPI y Llamadas Manuales)
      const store = leerBackendStore();
      const catalogo = store.catalogo;
      const { resolverAsesor } = construirResolvedorCatalogo(catalogo);

      // 2. Consultar EN CALIENTE las 4 APIs externas en paralelo con el rango [qDesde, qHasta] y WhatsApp de Supabase
      const [leadsApiRes, ncApiRes, pbxApiRes, celularApiRes, whatsappRes] = await Promise.all([
        consultarLeadsCalificadosEnCaliente({
          desde: qDesde,
          hasta: qHasta,
          pais: qPais,
          asesor: qAsesor,
          tipo_reunion: qTipoReunion,
          kpiLeads: store.kpiLeads,
        }),
        consultarLeadsNoCalificadosEnCaliente({
          desde: qDesde,
          hasta: qHasta,
          pais: qPais,
          kpiNoCalificados: store.kpiNoCalificados,
        }),
        consultarPbxEnCaliente({
          desde: qDesde,
          hasta: qHasta,
          hoy: rangoDefault.hoy,
          pais: qPais,
        }),
        consultarCelularEnCaliente({
          desde: qDesde,
          hasta: qHasta,
        }),
        consultarWhatsappDesdeSupabase(store.llamadasWhatsapp),
      ]);

      // 3. Enriquecer registros con el Catálogo Oficial de Ejecutivos en el backend
      const leads = leadsApiRes.data.map((l: any) => ({
        ...l,
        asesor_nombre: resolverAsesor(
          l.asesor_nombre || l.asesor_id,
          l.asesor_nombre ? String(l.asesor_nombre).trim() : 'Asesor General'
        ),
      }));

      const leadsNoCalificados = ncApiRes.data.map((nc: any) => ({
        ...nc,
        advisor_name: resolverAsesor(
          nc.advisor_name,
          nc.advisor_name ? String(nc.advisor_name).trim() : 'Asesor Asignado'
        ),
      }));

      // Combinar llamadas manuales en rango con las llamadas en vivo de las APIs
      const manualesPbxEnRango = store.llamadasPbxManuales.filter((m: any) => {
        const f = m.fecha || (m.fecha_hora ? String(m.fecha_hora).slice(0, 10) : '');
        return (!qDesde || f >= qDesde) && (!qHasta || f <= qHasta);
      });
      const manualesCelEnRango = store.llamadasCelularManuales.filter((m: any) => {
        const f = m.fecha ? String(m.fecha).slice(0, 10) : '';
        return (!qDesde || f >= qDesde) && (!qHasta || f <= qHasta);
      });

      const llamadasPbxFinal = [...manualesPbxEnRango, ...pbxApiRes.data].map((p: any) => ({
        ...p,
        asesor_nombre: resolverAsesor(
          p.nombre || p.extension,
          resolverAsesor(p.extension, p.nombre || (p.extension ? `Ext. ${p.extension}` : 'Línea PBX'))
        ),
        pais: p.pais || detectarPaisPorTelefono(p.destino, 'SV'),
      }));

      const llamadasCelularFinal = [...manualesCelEnRango, ...celularApiRes.data].map((c: any) => ({
        ...c,
        asesor_nombre: resolverAsesor(
          c.usuario,
          resolverAsesor(c.linea, c.usuario || 'Ejecutivo Celular')
        ),
      }));

      // 4. Extraer automáticamente prospectos con Reunión Virtual desde Leads hacia Teams y filtrar por rango activo
      const teamsEnRango = store.llamadasTeams.filter((t: any) => {
        const f = t.fecha_reunion ? String(t.fecha_reunion).slice(0, 10) : '';
        if (!f) return true;
        if (qDesde && f < qDesde) return false;
        if (qHasta && f > qHasta) return false;
        return true;
      });

      const mapaTeamsExistente = new Map<string, any>();
      teamsEnRango.forEach((t: any) => {
        if (t.codigo_prospecto) {
          mapaTeamsExistente.set(String(t.codigo_prospecto).trim().toLowerCase(), t);
        }
      });

      const llamadasTeams = [...teamsEnRango];
      leads.forEach((lv: any) => {
        const tipo = String(lv.tipo_reunion || '').toLowerCase();
        if (tipo.includes('virtual')) {
          const cod = String(lv.codigo_prospecto || '').trim().toLowerCase();
          if (cod && !mapaTeamsExistente.has(cod)) {
            llamadasTeams.push({
              id: `lead-virtual-${lv.id}`,
              codigo_prospecto: lv.codigo_prospecto,
              pais: lv.pais || 'SV',
              ejecutivo: lv.asesor_nombre,
              ejecutivo_nombre: lv.asesor_nombre,
              cliente:
                lv.nombre_prospecto ||
                (lv.codigo_prospecto ? `Prospecto ${lv.codigo_prospecto}` : 'Cliente Virtual'),
              fecha_reunion: lv.fecha_agendada || lv.fecha_creado,
              hora_reunion: lv.hora_agendada || lv.hora_creado,
              evidencia_url: '',
              estado_teams: 'Pendiente de realizar',
              origen_lead_virtual: true,
              lead_id: lv.id,
              telefono: lv.telefono,
            });
          }
        }
      });

      llamadasTeams.forEach((t: any) => {
        if (t.ejecutivo) {
          t.ejecutivo_nombre = resolverAsesor(t.ejecutivo, t.ejecutivo);
        }
        if (!t.cliente && t.codigo_prospecto) {
          t.cliente = `Prospecto ${t.codigo_prospecto}`;
        }
        if (!t.estado_teams) t.estado_teams = 'Pendiente de realizar';
      });

      const llamadasWhatsapp = llamadasWhatsappSort(whatsappRes.data).map((w: any) => ({
        ...w,
        asesor_nombre: resolverAsesor(
          w.numero_ejecutivo,
          w.numero_ejecutivo ? `Asesor ${w.numero_ejecutivo}` : 'Asesor WhatsApp'
        ),
        estado: w.estado || 'Entregado',
        direccion: w.direccion || 'Saliente',
      }));

      res.json({
        exito: true,
        modo: 'backend_en_caliente',
        rango: {
          desde: qDesde,
          hasta: qHasta,
          pais: qPais || 'AMBOS',
        },
        diagnostico: {
          leads_calificados_api: {
            ok: leadsApiRes.ok,
            total: leads.length,
            metadata: leadsApiRes.metadata,
            error: leadsApiRes.error,
          },
          leads_no_calificados_api: {
            ok: ncApiRes.ok,
            total: leadsNoCalificados.length,
            error: ncApiRes.error,
          },
          llamadas_pbx_api: {
            ok: pbxApiRes.ok,
            total: llamadasPbxFinal.length,
            error: pbxApiRes.error,
          },
          llamadas_celular_api: {
            ok: celularApiRes.ok,
            total: llamadasCelularFinal.length,
            error: celularApiRes.error,
          },
          llamadas_whatsapp_backend: {
            ok: true,
            total: llamadasWhatsapp.length,
          },
        },
        datos: {
          catalogo,
          leads,
          leadsNoCalificados,
          llamadasPbx: llamadasPbxFinal,
          llamadasCelular: llamadasCelularFinal,
          llamadasTeams,
          llamadasWhatsapp,
        },
        estadisticas: {
          total_leads_calificados: leads.length,
          total_leads_no_calificados: leadsNoCalificados.length,
          total_llamadas_pbx: llamadasPbxFinal.length,
          total_llamadas_celular: llamadasCelularFinal.length,
          total_llamadas_teams: llamadasTeams.length,
          total_llamadas_whatsapp: llamadasWhatsapp.length,
          total_catalogo: catalogo.length,
          tiempo_ms: Date.now() - inicioMs,
        },
      });
    } catch (error: any) {
      console.error('Error en consulta en caliente /api/sync/datos-completos:', error);
      res.status(500).json({
        exito: false,
        mensaje: error?.message || 'Error interno al consultar las APIs en el backend',
      });
    }
  });

  /**
   * Proxy autenticado para reproducir grabaciones de llamadas PBX directamente dentro del sistema
   */
  app.get('/api/pbx/audio', async (req, res) => {
    try {
      const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      if (!rawUrl) {
        return res.status(400).send('Falta parámetro url de audio PBX');
      }

      const targetUrl = rawUrl.startsWith('http')
        ? rawUrl
        : `${BACKEND_CONFIG.redPbxHost}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

      let auth = await obtenerJwtPbx(false);
      if (!auth.ok || !auth.token) {
        auth = await obtenerJwtPbx(true);
      }
      if (!auth.ok || !auth.token) {
        return res.status(502).send('No se pudo autenticar con el servidor PBX para obtener el audio');
      }

      const buildHeaders = (token: string): Record<string, string> => {
        const h: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'audio/wav,audio/*,*/*',
        };
        if (typeof req.headers.range === 'string') {
          h.Range = req.headers.range;
        }
        return h;
      };

      let upstream = await fetch(targetUrl, { headers: buildHeaders(auth.token) });
      if (upstream.status === 401) {
        const refreshed = await obtenerJwtPbx(true);
        if (refreshed.ok && refreshed.token) {
          upstream = await fetch(targetUrl, { headers: buildHeaders(refreshed.token) });
        }
      }

      if (!upstream.ok) {
        return res.status(upstream.status).send('Grabación no disponible en el servidor PBX para esta llamada.');
      }

      const contentType = upstream.headers.get('content-type') || 'audio/wav';
      const contentRange = upstream.headers.get('content-range');
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
      const arrayBuf = await upstream.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType.includes('audio') ? contentType : 'audio/wav');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Accept-Ranges', acceptRanges);
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      return res.send(buffer);
    } catch (err: any) {
      console.error('Error en proxy de audio PBX:', err);
      return res.status(500).send('Error al cargar el audio de la llamada PBX');
    }
  });

  /**
   * Consultar o actualizar parámetros de conexión de las APIs en el Backend
   */
  app.get('/api/config-backend', async (_req, res) => {
    const authTest = await obtenerJwtPbx(false);
    res.json({
      exito: true,
      config: {
        redPbxHost: BACKEND_CONFIG.redPbxHost,
        pbxUsername: BACKEND_CONFIG.pbxUsername,
        pbxTokenActivo: authTest.ok,
        prospektiaHost: BACKEND_CONFIG.prospektiaHost,
        prospektiaApiKeyMasked: `${BACKEND_CONFIG.prospektiaApiKey.slice(0, 10)}...`,
        celularApiUrl: BACKEND_CONFIG.celularApiUrl,
        celularApiKeyMasked: `${BACKEND_CONFIG.celularApiKey.slice(0, 10)}...`,
      },
    });
  });

  /**
   * Guardar cambios de KPIs (SLA / Retroalimentación) directamente en el Backend
   */
  app.patch('/api/leads/:id', (req, res) => {
    try {
      const { id } = req.params;
      const tabla = req.query.tabla === 'leads_no_calificados' ? 'leads_no_calificados' : 'leads';
      const body = req.body || {};

      const store = leerBackendStore();
      const targetMap = tabla === 'leads_no_calificados' ? store.kpiNoCalificados : store.kpiLeads;
      const key = String(body.codigo_prospecto || id).trim();

      const actual = targetMap[key] || targetMap[id] || { id };
      const allowedKpis = [
        'kpi_sla_etapa_1',
        'kpi_sla_etapa_2',
        'kpi_sla_etapa_3',
        'kpi_retroalimentacion_etapa_1',
        'kpi_retroalimentacion_etapa_2',
        'kpi_retroalimentacion_etapa_3',
        'kpi_retroalimentacion_etapa_4',
      ];
      for (const k of allowedKpis) {
        if (k in body) actual[k] = Boolean(body[k]);
      }

      targetMap[key] = actual;
      targetMap[id] = actual;
      guardarBackendStore(store);

      res.json({ exito: true, data: actual });
    } catch (error: any) {
      res.status(500).json({ exito: false, error: error.message });
    }
  });

  /**
   * Autenticación de usuarios del sistema (Admin Gabi y Usuarios del Catálogo con contraseña)
   */
  app.post('/api/auth/login', (req, res) => {
    try {
      const { usuario, password } = req.body || {};
      const userClean = String(usuario || '').trim();
      const passClean = String(password || '').trim();

      if (!userClean || !passClean) {
        return res.status(400).json({ exito: false, mensaje: 'Ingresa usuario y contraseña.' });
      }

      // 1. Super Administrador por defecto
      if (userClean.toLowerCase() === 'gabi' && passClean === '1234') {
        return res.json({
          exito: true,
          token: `jwt-gabi-${Date.now()}`,
          usuario: {
            nombre: 'Gabi',
            rol: 'Super Administrador / Auditor',
          },
        });
      }

      // 2. Buscar en el Catálogo de Usuarios/Ejecutivos del Backend
      const store = leerBackendStore();
      const encontrado = store.catalogo.find((c: any) => {
        const u = String(c.usuario || '').trim().toLowerCase();
        const n = String(c.nombre_ejecutivo || '').trim().toLowerCase();
        const inputLower = userClean.toLowerCase();
        return (u && u === inputLower) || (n && n === inputLower);
      });

      if (encontrado) {
        const passGuardada = String(encontrado.password || '1234').trim();
        if (passClean === passGuardada) {
          return res.json({
            exito: true,
            token: `jwt-${encontrado.id || Date.now()}`,
            usuario: {
              nombre: encontrado.nombre_ejecutivo || encontrado.usuario,
              rol: `Ejecutivo (${encontrado.pais || 'SV'})`,
            },
          });
        } else {
          return res.status(401).json({
            exito: false,
            mensaje: 'Contraseña incorrecta para este usuario.',
          });
        }
      }

      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario o contraseña no válidos.',
      });
    } catch (err: any) {
      return res.status(500).json({ exito: false, mensaje: err.message });
    }
  });

  /**
   * CRUD Catálogo en el Backend
   */
  app.post('/api/catalogo', (req, res) => {
    try {
      const store = leerBackendStore();
      const maxId = store.catalogo.reduce((acc, item) => Math.max(acc, Number(item.id) || 0), 0);
      const nuevo = {
        ...req.body,
        id: maxId + 1,
        created_at: new Date().toISOString(),
      };
      store.catalogo.push(nuevo);
      guardarBackendStore(store);
      res.status(201).json({ exito: true, data: nuevo });
    } catch (err: any) {
      res.status(500).json({ exito: false, error: err.message });
    }
  });

  app.patch('/api/catalogo/:id', (req, res) => {
    try {
      const { id } = req.params;
      const store = leerBackendStore();
      const idx = store.catalogo.findIndex((c) => String(c.id) === String(id));
      if (idx === -1) {
        return res.status(404).json({ exito: false, error: 'Ejecutivo no encontrado en el catálogo' });
      }
      store.catalogo[idx] = { ...store.catalogo[idx], ...req.body };
      guardarBackendStore(store);
      res.json({ exito: true, data: store.catalogo[idx] });
    } catch (err: any) {
      res.status(500).json({ exito: false, error: err.message });
    }
  });

  app.delete('/api/catalogo/:id', (req, res) => {
    try {
      const { id } = req.params;
      const store = leerBackendStore();
      store.catalogo = store.catalogo.filter((c) => String(c.id) !== String(id));
      guardarBackendStore(store);
      res.json({ exito: true });
    } catch (err: any) {
      res.status(500).json({ exito: false, error: err.message });
    }
  });

  /**
   * Guardar o actualizar Reunión Teams en el Backend
   */
  app.post('/api/teams', (req, res) => {
    try {
      const reunion = { ...req.body };
      const store = leerBackendStore();

      const idx = store.llamadasTeams.findIndex(
        (t) =>
          (reunion.id && typeof reunion.id === 'number' && String(t.id) === String(reunion.id)) ||
          (reunion.codigo_prospecto &&
            t.codigo_prospecto &&
            String(t.codigo_prospecto).trim().toLowerCase() ===
              String(reunion.codigo_prospecto).trim().toLowerCase())
      );

      if (idx >= 0) {
        store.llamadasTeams[idx] = {
          ...store.llamadasTeams[idx],
          ...reunion,
          id: store.llamadasTeams[idx].id,
        };
        guardarBackendStore(store);
        return res.json({ exito: true, data: store.llamadasTeams[idx] });
      } else {
        const maxId = store.llamadasTeams.reduce((acc, item) => Math.max(acc, Number(item.id) || 0), 0);
        const nueva = {
          ...reunion,
          id: maxId + 1,
          created_at: new Date().toISOString(),
        };
        store.llamadasTeams.unshift(nueva);
        guardarBackendStore(store);
        return res.json({ exito: true, data: nueva });
      }
    } catch (err: any) {
      res.status(500).json({ exito: false, error: err.message });
    }
  });

  /**
   * Guardar Llamada Manual (PBX o Celular) en el Backend
   */
  app.post('/api/llamadas/:tipo', (req, res) => {
    try {
      const { tipo } = req.params;
      const datos = req.body || {};
      const fechaFinal = datos.fecha || new Date().toISOString().slice(0, 10);
      const horaFinal = datos.hora || '10:00:00';
      const store = leerBackendStore();

      if (tipo === 'pbx') {
        const payload = {
          id: hashAUuid(`manual_pbx_${Date.now()}`),
          uniqueid: `manual_pbx_${Date.now()}`,
          nombre: datos.ejecutivo || 'ASESOR',
          extension: datos.extension || '4000',
          prefijo: '9',
          destino: datos.telefono_destino ? String(datos.telefono_destino).trim() : '',
          duracion_segundos: Number(datos.duracion_segundos || 180),
          duracion_minutos: Math.round((Number(datos.duracion_segundos || 180) / 60) * 100) / 100,
          duracion_hh_mm_ss: '00:03:00',
          estado: datos.estado || 'CONTESTADA',
          fecha_hora: `${fechaFinal}T${horaFinal}`,
          fecha: fechaFinal,
          solo_fecha: fechaFinal,
          anio: Number(fechaFinal.slice(0, 4)),
          mes: Number(fechaFinal.slice(5, 7)),
          dia: Number(fechaFinal.slice(8, 10)),
          pais: datos.pais || 'SV',
          fuente_llamada: 'PBX',
        };
        store.llamadasPbxManuales.unshift(payload);
        guardarBackendStore(store);
        return res.json({ exito: true, data: payload });
      } else {
        const payload = {
          id: Date.now(),
          fecha: fechaFinal,
          hora: horaFinal,
          destino: datos.telefono_destino ? String(datos.telefono_destino).trim() : '',
          duracion: Number(datos.duracion_segundos || 180),
          tipo: 'Saliente',
          linea: 'Manual',
          operador: 'Claro / Tigo',
          usuario: datos.ejecutivo || 'ASESOR',
        };
        store.llamadasCelularManuales.unshift(payload);
        guardarBackendStore(store);
        return res.json({ exito: true, data: payload });
      }
    } catch (err: any) {
      res.status(500).json({ exito: false, error: err.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend de Consulta en Caliente ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

function llamadasWhatsappSort(arr: any[]): any[] {
  return [...arr].sort((a, b) =>
    String(b.fecha_llamada || b.created_at || '').localeCompare(String(a.fecha_llamada || a.created_at || ''))
  );
}

startServer();
