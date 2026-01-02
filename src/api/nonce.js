// api/nonce.js (Vercel style)
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const address = (req.query.address || '').toLowerCase();
  if (!address) return res.status(400).json({ error: 'missing address' });

  // create nonce
  const nonce = crypto.randomBytes(16).toString('hex');
  const { error } = await supabase.from('nonces').insert([{ nonce, address, created_at: new Date().toISOString(), used: false }]);
  if (error) {
    console.error('nonce insert err', error);
    return res.status(500).json({ error: 'db error' });
  }
  return res.json({ nonce });
}
