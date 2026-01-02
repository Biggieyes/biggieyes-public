# BiggiEyes Live Chat (Serverless + Supabase)

This repo includes a serverless chat backend and a LiveStats fullscreen chat UI.

## Overview
- Frontend chat UI: `src/components/LiveChatPanel.jsx` (Supabase Realtime + signed sends).
- Serverless API:
  - `api/nonce.js` (GET/POST)
  - `api/message.js` (POST)
  - `api/admin/editMessage.js` (POST)
- Supabase SQL: `sql/migration_init.sql`
- Manual test script: `scripts/test_flow.js`

## Environment Variables

### Serverless (Vercel/Netlify)
Do NOT commit the service role key.

```
SUPABASE_URL=https://kjwbcfevadkexohspuey.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
CHAT_OWNER_ADDRESS=0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0
PLATFORM=vercel
```

### Frontend (Vite)
```
VITE_SUPABASE_URL=https://kjwbcfevadkexohspuey.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_x86muUVvzlG4ECeD5kLDyA_LuwFtnsT
VITE_CHAT_API_BASE=
```

`VITE_CHAT_API_BASE` is optional. Leave empty when the API is on the same origin (Vercel /api). For Netlify, set:
```
VITE_CHAT_API_BASE=https://biggieyes.com/.netlify/functions
```

## Supabase Setup
1. Create a Supabase project.
2. Run `sql/migration_init.sql` in the SQL editor.
3. The SQL seed already contains the owner address:
   `0x64ADb3e4B5BE8567c599bA8e050F7016C3D51eD0`
4. Ensure RLS is enabled (migration does this) and only `SELECT` is public.

## Message Signing
- Client payload format:
  ```
  ${nonce}|${content}|${timestamp}
  ```
  `timestamp` is milliseconds since epoch.

## Admin Signature
- Admin payload format:
  ```
  ${action}|${messageId}|${newContent || ""}
  ```
  where action is `edit` or `soft-delete`.

## Rate Limits
Server checks per address:
- max 1 message / 5s
- max 10 messages / 60s

## Manual Test Script
```
CHAT_BASE_URL=http://localhost:3000
CHAT_OWNER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
node scripts/test_flow.js
```

## Deployment Notes
### Vercel
- Ensure env vars are set in Vercel dashboard.
- Functions live in `api/`.

### Netlify
- Ensure env vars are set in Netlify dashboard.
- Use Netlify Functions with the same `api/` folder.
- Endpoints:
- `https://biggieyes.com/.netlify/functions/nonce`
- `https://biggieyes.com/.netlify/functions/message`
- `https://biggieyes.com/.netlify/functions/admin/editMessage`

## Security Notes
- Service role key must stay in env only.
- Client uses anon key for SELECT only.
- All writes go through serverless functions with signature verification.
