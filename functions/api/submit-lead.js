// Wealth Path Calculator — Lead Submission Proxy
// (C) 2026 Healthy Wealthy Investor — All Rights Reserved

const ALLOWED_ORIGINS = [
  'https://hwi-wealth-calculator.pages.dev',
  'https://healthywealthyinvestor.com.au',
  'https://www.healthywealthyinvestor.com.au',
  'http://localhost:8788',
  'http://localhost:3000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

export async function onRequestPost(context) {
  const origin = context.request.headers.get('Origin') || '';
  const headers = corsHeaders(origin);

  try {
    const payload = await context.request.json();
    const results = { listmonk: null, sheets: null };
    const listmonk = await submitToListmonk(context.env, payload);
    results.listmonk = listmonk.status;

    // Fallback only. Listmonk is the source of truth.
    if (listmonk.status !== 'ok' && context.env.GOOGLE_SHEETS_WEBHOOK) {
      try {
        const sheetsRes = await fetch(context.env.GOOGLE_SHEETS_WEBHOOK, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        results.sheets = sheetsRes.ok ? 'ok' : 'error';
      } catch {
        results.sheets = 'error';
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid request', details: err.message }),
      { status: 400, headers }
    );
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function parseListIds(raw) {
  return String(raw || '')
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(Number.isFinite);
}

function cleanEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function deriveName(payload, email) {
  const explicit = String(payload.name || '').trim();
  if (explicit) return explicit;
  return email.split('@')[0] || 'HWI subscriber';
}

function listmonkAuth(env) {
  const user = env.LISTMONK_API_USER;
  const token = env.LISTMONK_API_TOKEN;
  if (!user || !token) return '';
  return 'Basic ' + btoa(user + ':' + token);
}

function buildAttribs(payload) {
  return {
    source: payload.source || 'wealth-path-calculator',
    funnel: 'structure-beats-prediction',
    calculator: 'smsf-property-structure-test',
    submitted_at: new Date().toISOString(),
    property_value: payload.propertyValue || '',
    household_income: payload.householdIncome || '',
    total_wealth: payload.totalWealth || '',
    stage_reached: payload.stageReached || '',
    properties_count: payload.propertiesCount || '',
    structure: payload.structure || '',
    structure_test: payload.structureTest || null,
  };
}

async function listmonkFetch(env, path, init = {}) {
  const base = String(env.LISTMONK_BASE_URL || '').replace(/\/$/, '');
  const auth = listmonkAuth(env);
  if (!base || !auth) throw new Error('Listmonk env missing');

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', auth);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(base + path, { ...init, headers });
}

async function findSubscriberByEmail(env, email) {
  const query = "subscribers.email = '" + email.replace(/'/g, "''") + "'";
  const params = new URLSearchParams({ query, per_page: '1' });
  const res = await listmonkFetch(env, '/api/subscribers?' + params.toString());
  if (!res.ok) return null;
  const body = await res.json();
  const results = body && body.data && body.data.results;
  return Array.isArray(results) && results.length ? results[0] : null;
}

async function addSubscriberToLists(env, subscriberId, listIds) {
  if (!subscriberId || !listIds.length) return;
  await listmonkFetch(env, '/api/subscribers/lists', {
    method: 'PUT',
    body: JSON.stringify({
      ids: [subscriberId],
      action: 'add',
      target_list_ids: listIds,
      status: 'confirmed',
    }),
  });
}

async function patchSubscriberAttribs(env, subscriberId, attribs) {
  if (!subscriberId) return;
  await listmonkFetch(env, '/api/subscribers/' + subscriberId, {
    method: 'PATCH',
    body: JSON.stringify({ attribs, status: 'enabled' }),
  });
}

async function submitToListmonk(env, payload) {
  const email = cleanEmail(payload.email);
  const listIds = parseListIds(env.LISTMONK_LIST_IDS || '24');
  if (!email || !email.includes('@')) return { status: 'invalid-email' };
  if (!listIds.length) return { status: 'missing-list' };
  if (!env.LISTMONK_BASE_URL || !env.LISTMONK_API_USER || !env.LISTMONK_API_TOKEN) {
    return { status: 'not-configured' };
  }

  const attribs = buildAttribs(payload);
  const body = {
    email,
    name: deriveName(payload, email),
    status: 'enabled',
    lists: listIds,
    attribs,
    preconfirm_subscriptions: true,
  };

  try {
    const res = await listmonkFetch(env, '/api/subscribers', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (res.ok) return { status: 'ok' };

    const text = await res.text();
    if (res.status === 409 || /exist|duplicate/i.test(text)) {
      const existing = await findSubscriberByEmail(env, email);
      if (!existing) return { status: 'duplicate-not-found' };
      await patchSubscriberAttribs(env, existing.id, attribs);
      await addSubscriberToLists(env, existing.id, listIds);
      return { status: 'ok' };
    }

    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}
