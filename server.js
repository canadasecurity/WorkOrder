/**
 * Local development server:
 * - Serves the static work-order site
 * - Proxies GET/POST /api/customers → Google Apps Script (Sheet ContactDetails)
 *
 * Usage:
 *   1. Deploy google-apps-script/ (see DEPLOY.md)
 *   2. Set APPS_SCRIPT_URL in .env and js/constants.js
 *   3. npm run dev → http://localhost:8080
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  callAppsScript,
  fetchAppsScriptGet,
} from './api/apps-script-proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.static(__dirname));

app.get('/api/customers', async (_req, res) => {
  try {
    const data = await fetchAppsScriptGet(APPS_SCRIPT_URL, 'action=customers');
    if (data.ok === false) {
      return res.status(502).json(data);
    }
    if (!Array.isArray(data.customers)) {
      return res.status(502).json({
        ok: false,
        error:
          'Apps Script did not return a customers array. Paste the latest Code.gs and deploy a New version. Test: YOUR_EXEC_URL?action=customers',
        received: data,
      });
    }
    res.json(data);
  } catch (err) {
    console.error('GET /api/customers:', err);
    res.status(err.statusCode || 500).json({
      ok: false,
      error: err.message || 'Failed to load customers from Google Sheet',
    });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const body = { ...(req.body || {}), action: 'addCustomer' };
    const data = await callAppsScript(APPS_SCRIPT_URL, body);
    if (!data.ok) {
      return res.status(502).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error('POST /api/customers:', err);
    res.status(err.statusCode || 500).json({
      ok: false,
      error: err.message || 'Failed to add customer to Google Sheet',
    });
  }
});

app.post('/api/submit', async (req, res) => {
  try {
    const data = await callAppsScript(APPS_SCRIPT_URL, {
      ...(req.body || {}),
      action: 'sendWorkOrder',
    });

    const sentOk =
      data.ok === true &&
      data.sent === true &&
      Array.isArray(data.recipients) &&
      data.recipients.length > 0;

    if (!sentOk) {
      return res.status(502).json({
        ok: false,
        error:
          data.error ||
          'Apps Script did not confirm send. Redeploy Code.gs (mail + sheet) as a New version.',
        received: data,
      });
    }

    res.json({
      ok: true,
      sent: true,
      recipients: data.recipients,
      remainingQuota: data.remainingQuota,
      version: data.version,
    });
  } catch (err) {
    console.error('POST /api/submit:', err);
    res.status(err.statusCode || 500).json({
      ok: false,
      error: err.message || 'Failed to send work order',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Work Order app running at http://localhost:${PORT}`);
  console.log(
    APPS_SCRIPT_URL
      ? `Apps Script: ${APPS_SCRIPT_URL}`
      : 'WARNING: APPS_SCRIPT_URL is not set in .env'
  );
});
