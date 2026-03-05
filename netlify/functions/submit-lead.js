// ╔═══════════════════════════════════════════════════════════════╗
// ║  Wealth Path Calculator — Lead Submission Proxy               ║
// ║  © 2026 Healthy Wealthy Investor — All Rights Reserved        ║
// ╚═══════════════════════════════════════════════════════════════╝

const ALLOWED_ORIGINS = [
  'https://hwi-wealth-calculator.netlify.app',
  'https://healthywealthyinvestor.com.au',
  'https://www.healthywealthyinvestor.com.au',
  'http://localhost:8888',
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

exports.handler = async function(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);

    const results = { sheets: null, wordpress: null };

    // Forward to Google Sheets
    const sheetsUrl = process.env.GOOGLE_SHEETS_WEBHOOK;
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
    const wpUrl = process.env.WP_LEAD_ENDPOINT;
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, results }),
    };

  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request', details: err.message }),
    };
  }
};
