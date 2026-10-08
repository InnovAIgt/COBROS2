import { Cita, Llamada, ParametrosAuditoria } from '../types';

/**
 * Sin datos quemados: todas las listas iniciales están vacías y se alimentan
 * exclusivamente de las consultas en caliente a las APIs y Supabase.
 */
export const CITAS_INICIALES: Cita[] = [];

export const LLAMADAS_INICIALES: Llamada[] = [];

export const PARAMETROS_DEFAULT: ParametrosAuditoria = {
  tolerancia_anticipacion_minutos: 5,
  tolerancia_retraso_a_tiempo_minutos: 5,
  umbral_retraso_grave_minutos: 15,
  duracion_minima_efectiva_segundos: 45,
  considerar_buzon_como_fallido: true,
  horario_laboral_inicio: '08:00',
  horario_laboral_fin: '18:00',
};
