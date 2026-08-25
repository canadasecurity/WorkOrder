/**
 * Call Google Apps Script Web App reliably from Node.
 * POST → 302 → GET echo URL (Google attaches the POST body via user_content_key).
 */
export async function callAppsScript(appsScriptUrl, payload) {
  if (!appsScriptUrl || !appsScriptUrl.includes('/exec')) {
    const err = new Error(
      'APPS_SCRIPT_URL is missing or invalid. Deploy google-apps-script and paste the /exec URL into .env and js/constants.js'
    );
    err.statusCode = 500;
    throw err;
  }

  const body = JSON.stringify(payload);
  const res = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow',
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('Apps Script raw response:', text.slice(0, 300));
    const err = new Error(
      'Apps Script returned a non-JSON response. Redeploy Code.gs as a New version.'
    );
    err.statusCode = 502;
    throw err;
  }

  return data;
}

export async function fetchAppsScriptGet(appsScriptUrl, query = '') {
  if (!appsScriptUrl || !appsScriptUrl.includes('/exec')) {
    const err = new Error(
      'APPS_SCRIPT_URL is missing or invalid. Deploy google-apps-script and paste the /exec URL into .env and js/constants.js'
    );
    err.statusCode = 500;
    throw err;
  }

  const url = query
    ? `${appsScriptUrl}${appsScriptUrl.includes('?') ? '&' : '?'}${query.replace(/^\?/, '')}`
    : appsScriptUrl;

  let lastError;
  for (const delayMs of [0, 1000, 3000]) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
      const res = await fetch(url, { redirect: 'follow' });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        lastError = new Error(
          `Apps Script returned non-JSON (HTTP ${res.status}).`
        );
        lastError.statusCode = 502;
        console.error('Apps Script GET raw:', text.slice(0, 300));
        continue;
      }

      if (!res.ok) {
        lastError = new Error(
          data.error || `Apps Script GET failed (HTTP ${res.status}).`
        );
        lastError.statusCode = 502;
        continue;
      }

      return data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Apps Script GET failed after retries.');
}
