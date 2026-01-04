// api/nonce.js (Vercel style)
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const respond = (res, status, payload) => res.status(status).json(payload);

export default async function handler(req, res) {
  // Accept both GET?address=0x... and POST { address: '0x...' } to be compatible across deploy targets.
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'OPTIONS') {
    return res.status(405).end();
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase service env for nonce handler');
    return respond(res, 500, { ok: false, error: 'Server misconfiguration' });
  }

  if (req.method === 'OPTIONS') return respond(res, 200, { ok: true });

  const rawAddress = (req.method === 'GET' ? req.query.address : req.body?.address) || '';
  const address = String(rawAddress || '').trim().toLowerCase();
  if (!address) return respond(res, 400, { ok: false, error: 'missing address' });

  // create nonce
  const nonce = crypto.randomBytes(16).toString('hex');
  try {
    const { error } = await supabase.from('nonces').insert([{ nonce, address, created_at: new Date().toISOString(), used: false }]);
    if (error) {
      console.error('nonce insert err', error);
      return respond(res, 500, { ok: false, error: 'db error' });
    }
    return respond(res, 200, { ok: true, nonce });
  } catch (e) {
    console.error('nonce insert unexpected', e);
    return respond(res, 500, { ok: false, error: 'db error' });
  }
}
