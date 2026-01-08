// api/message.js
import { verifyMessage } from "ethers";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MAX_AGE_MS = 2 * 60 * 1000; // 2 minuty
const MAX_LENGTH = 2000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const { address, content, signature, nonce, timestamp, name } = req.body;
    if (!address || !content || !signature || !nonce || !timestamp)
      return res.status(400).json({ error: "missing fields" });
    if (
      typeof content !== "string" ||
      content.length === 0 ||
      content.length > MAX_LENGTH
    )
      return res.status(400).json({ error: "invalid content" });

    const ts = Number(timestamp);
    if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS)
      return res.status(400).json({ error: "timestamp expired or invalid" });

    // check nonce exists and not used
    const { data: existing } = await supabase
      .from("nonces")
      .select("*")
      .eq("nonce", nonce)
      .limit(1)
      .single();
    if (!existing) return res.status(400).json({ error: "nonce not found" });
    if (existing.used)
      return res.status(400).json({ error: "nonce already used" });
    if (existing.address.toLowerCase() !== address.toLowerCase())
      return res.status(400).json({ error: "nonce address mismatch" });

    // verify signature (payload must match client)
    const payload = `${nonce}|${content}|${timestamp}`;
    let recovered;
    try {
      recovered = verifyMessage(payload, signature);
    } catch {
      return res.status(400).json({ error: "invalid signature" });
    }
    if (recovered.toLowerCase() !== address.toLowerCase())
      return res.status(401).json({ error: "signature mismatch" });

    // OPTIONAL: profanity/rate-limit checks here (DB queries), skip for brevity

    // insert message
    const insert = {
      author_address: address.toLowerCase(),
      author_name: name || null,
      content,
      created_at: new Date().toISOString(),
      deleted: false,
    };
    const { error: insertErr } = await supabase
      .from("messages")
      .insert([insert]);
    if (insertErr) {
      console.error("insertErr", insertErr);
      return res.status(500).json({ error: "db insert failed" });
    }

    // mark nonce used
    await supabase.from("nonces").update({ used: true }).eq("nonce", nonce);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "unexpected" });
  }
}

