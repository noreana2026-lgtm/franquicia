import { createClient } from '@supabase/supabase-js';

// URL y clave pública: públicas por diseño; la seguridad va por RLS y funciones.
const SUPABASE_URL = 'https://gegsauzfwvfhzsemtszn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_buJTOsgFc-y3hKYnqgxWkg_oO8qiuvr';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const code4 = () => Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

export async function createRoom(hostId, state) {
  for (let i = 0; i < 6; i++) {
    const code = code4();
    const { data, error } = await sb.rpc('fq_create_room', { p_code: code, p_host: hostId, p_state: state });
    if (error) throw error;
    if (data) return code;
  }
  throw new Error('No se pudo crear la sala');
}

export async function getRoom(code) {
  const { data, error } = await sb.from('fq_rooms').select('code,version,state').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateRoom(code, version, state) {
  const { data, error } = await sb.rpc('fq_update_room', { p_code: code, p_version: version, p_state: state });
  if (error) throw error;
  return data;
}

export function subscribeRoom(code, cb) {
  const ch = sb
    .channel('fq-' + code)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fq_rooms', filter: `code=eq.${code}` }, (p) => cb(p.new))
    .subscribe();
  return () => { sb.removeChannel(ch); };
}
