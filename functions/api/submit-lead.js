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
    const results = { sheets: null, wordpress: null };

    // Forward to Google Sheets
    const sheetsUrl = context.env.GOOGLE_SHEETS_WEBHOOK;
    if (sheetsUrl) {
      try {
        const sheetsRes = await fetch(sheetsUrl, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        results.sheets = sheetsRes.ok ? 'ok' : 'error';
      } catch {
        results.sheets = 'error';
      }
    }

    // Forward to WordPress
    const wpUrl = context.env.WP_LEAD_ENDPOINT;
    if (wpUrl) {
      try {
        const wpRes = await fetch(wpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        results.wordpress = wpRes.ok ? 'ok' : 'error';
      } catch {
        results.wordpress = 'error';
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
