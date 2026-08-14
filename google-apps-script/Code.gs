/**
 * Canada Security Group — Customer sheet + work-order email
 *
 * Spreadsheet: ContactDetails tab
 * Columns: Customer | Corporation number | Main email | Primary contact | Main Phone | Fax
 *
 * Deploy while logged in as: accounts@canadasecuritygroup.com
 * After edits: Deploy → Manage deployments → Edit → New version → Deploy
 */

var CUSTOMERS_SHEET_ID = '1GFt_zd_h9vpfUP4ualeDfM8CxcJ3Fw7ou-q_UMzch8o';
var CUSTOMERS_SHEET_NAME = 'ContactDetails';
var CUSTOMERS_CACHE_SECONDS = 60;
var DEFAULT_NOTIFY_EMAIL = 'accounts@canadasecuritygroup.com';
var SCRIPT_VERSION = '2026-08-10-accounts-mail-v5';

function authorizeSetup() {
  SpreadsheetApp.openById(CUSTOMERS_SHEET_ID).getSheetByName(CUSTOMERS_SHEET_NAME);
  MailApp.getRemainingDailyQuota();
  Logger.log(
    'Authorization OK. Sheet: ' +
      CUSTOMERS_SHEET_NAME +
      '. Remaining mail quota: ' +
      MailApp.getRemainingDailyQuota()
  );
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action === 'customers') {
      return jsonResponse(getCustomersPayload_());
    }
    if (params.test === '1') {
      return sendTestEmail_(params.to || DEFAULT_NOTIFY_EMAIL);
    }
    return jsonResponse({
      ok: true,
      sent: false,
      action: 'health',
      version: SCRIPT_VERSION,
      service: 'Canada Security Group Customers + Mailer',
      remainingQuota: MailApp.getRemainingDailyQuota(),
      hint: 'Use ?action=customers or ?test=1 to test email.',
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      sent: false,
      version: SCRIPT_VERSION,
      error: String(err && err.message ? err.message : err),
    });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!raw) {
      return jsonResponse({ ok: false, sent: false, error: 'Empty POST body.' });
    }
    var body = JSON.parse(raw);

    if (body.action === 'addCustomer') {
      return jsonResponse(addCustomer_(body));
    }

    // Default POST = send work order email
    return jsonResponse(processSend_(body));
  } catch (err) {
    return jsonResponse({
      ok: false,
      sent: false,
      version: SCRIPT_VERSION,
      error: String(err && err.message ? err.message : err),
    });
  }
}

function processSend_(body) {
  var formData = body.formData || {};
  var customerEmails = body.customerEmails || [];
  var subject =
    body.subject ||
    'Work Order ' +
      (formData.workOrderNumber || '') +
      ' — ' +
      (formData.address || 'Canada Security Group');

  var recipients = uniqueEmails(
    [].concat(customerEmails, String(DEFAULT_NOTIFY_EMAIL).split(','))
  );

  if (!recipients.length) {
    return {
      ok: false,
      sent: false,
      version: SCRIPT_VERSION,
      error: 'No recipient emails provided.',
    };
  }

  var plain =
    'Work Order ' +
    (formData.workOrderNumber || '') +
    '\nAddress: ' +
    (formData.address || '') +
    '\nTechnician: ' +
    (formData.technician || '') +
    '\nCustomer: ' +
    (formData.customerName || '') +
    '\n\nPlease open the attached PDF for the full work order.';

  var htmlBody =
    '<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.4">' +
    '<strong>Work Order ' +
    escapeHtml_(formData.workOrderNumber || '') +
    '</strong><br>' +
    'Address: ' +
    escapeHtml_(formData.address || '') +
    '<br>' +
    'Technician: ' +
    escapeHtml_(formData.technician || '') +
    '<br><br>' +
    'Please open the attached PDF for the full work order.' +
    '</p>';

  var attachments = [];
  if (body.pdfBase64) {
    try {
      var pdfBlob = Utilities.newBlob(
        Utilities.base64Decode(body.pdfBase64),
        'application/pdf',
        body.pdfFilename ||
          'Work-Order-' + (formData.workOrderNumber || 'CSG') + '.pdf'
      );
      attachments.push(pdfBlob);
    } catch (attachErr) {
      return {
        ok: false,
        sent: false,
        version: SCRIPT_VERSION,
        error:
          'Invalid PDF attachment: ' +
          String(attachErr && attachErr.message ? attachErr.message : attachErr),
      };
    }
  } else {
    return {
      ok: false,
      sent: false,
      version: SCRIPT_VERSION,
      error: 'Missing PDF snapshot of the work order preview.',
    };
  }

  var remaining = MailApp.getRemainingDailyQuota();
  if (remaining < recipients.length) {
    return {
      ok: false,
      sent: false,
      version: SCRIPT_VERSION,
      error: 'Daily Gmail send quota too low. Remaining: ' + remaining,
    };
  }

  // One message to everyone (customers + accounts@).
  // Important: when script runs AS accounts@, a separate "To: accounts@" send
  // is mail-to-self. Workspace often skips Inbox and can look missing in Sent.
  // Putting accounts@ on the same To: line with customers still delivers to
  // customers and keeps accounts@ visible on the Sent message recipients.
  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    body: plain,
    htmlBody: htmlBody,
    attachments: attachments,
    name: 'Canada Security Group',
    replyTo: DEFAULT_NOTIFY_EMAIL,
  });

  return {
    ok: true,
    sent: true,
    action: 'sendWorkOrder',
    version: SCRIPT_VERSION,
    recipients: recipients,
    remainingQuota: MailApp.getRemainingDailyQuota(),
    attachedPdf: true,
    note:
      'If accounts@ is the sender, that address will not get a normal Inbox copy (mail-to-self). Check Sent — recipients listed there should include accounts@.',
  };
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendTestEmail_(to) {
  var email = String(to || DEFAULT_NOTIFY_EMAIL).trim();
  MailApp.sendEmail({
    to: email,
    subject: 'CSG Work Order — TEST EMAIL ' + new Date().toISOString(),
    body: 'Apps Script mail OK.\nVersion: ' + SCRIPT_VERSION,
    name: 'Canada Security Group',
    replyTo: DEFAULT_NOTIFY_EMAIL,
  });
  return jsonResponse({
    ok: true,
    sent: true,
    action: 'testSend',
    version: SCRIPT_VERSION,
    recipients: [email],
    remainingQuota: MailApp.getRemainingDailyQuota(),
  });
}

function uniqueEmails(list) {
  var seen = {};
  var out = [];
  (list || []).forEach(function (raw) {
    var email = String(raw || '')
      .trim()
      .toLowerCase();
    if (email && email.indexOf('@') >= 0 && !seen[email]) {
      seen[email] = true;
      out.push(email);
    }
  });
  return out;
}

function getCustomersPayload_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('customers:payload');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (ignore) {}
  }

  var parsed = readSheetRows_();
  if (!parsed.ok) return parsed;

  var customers = [];
  var corpSeen = {};
  var corporationNumbers = [];

  for (var i = 0; i < parsed.rows.length; i++) {
    var row = parsed.rows[i];
    var address = cell_(row, parsed.col.customer);
    if (!address) continue;

    var corpRaw = cell_(row, parsed.col.corporationNo);
    var corporationNo = corpRaw || null;
    var emails = parseEmails_(cell_(row, parsed.col.emails));

    customers.push({
      id: String(parsed.dataStartRow + i),
      name: address,
      address: address,
      corporationNo: corporationNo,
      emails: emails,
      primaryContact: cell_(row, parsed.col.primaryContact),
      phone: cell_(row, parsed.col.phone),
      fax: cell_(row, parsed.col.fax),
    });

    if (corporationNo && !corpSeen[corporationNo]) {
      corpSeen[corporationNo] = true;
      corporationNumbers.push(corporationNo);
    }
  }

  corporationNumbers.sort(function (a, b) {
    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  var payload = {
    ok: true,
    customers: customers,
    corporationNumbers: corporationNumbers,
    count: customers.length,
    version: SCRIPT_VERSION,
  };

  try {
    cache.put('customers:payload', JSON.stringify(payload), CUSTOMERS_CACHE_SECONDS);
  } catch (cacheErr) {}

  return payload;
}

function addCustomer_(body) {
  var address = String(body.address || body.customer || '').trim();
  if (!address) {
    return { ok: false, error: 'Address (Customer) is required.' };
  }

  var corporationNo = String(body.corporationNo || '').trim();
  var emailsRaw = Array.isArray(body.emails)
    ? body.emails.join(', ')
    : String(body.email || body.emails || '').trim();
  var emails = parseEmails_(emailsRaw);
  var primaryContact = String(body.primaryContact || '').trim();
  var phone = String(body.phone || '').trim();
  var fax = String(body.fax || '').trim();

  var parsed = readSheetRows_();
  if (!parsed.ok) return parsed;

  var addressKey = address.toLowerCase();
  for (var i = 0; i < parsed.rows.length; i++) {
    var existing = cell_(parsed.rows[i], parsed.col.customer).toLowerCase();
    if (existing === addressKey) {
      var existingId = String(parsed.dataStartRow + i);
      return {
        ok: true,
        alreadyExists: true,
        customer: {
          id: existingId,
          name: cell_(parsed.rows[i], parsed.col.customer),
          address: cell_(parsed.rows[i], parsed.col.customer),
          corporationNo:
            cell_(parsed.rows[i], parsed.col.corporationNo) || null,
          emails: parseEmails_(cell_(parsed.rows[i], parsed.col.emails)),
          primaryContact: cell_(parsed.rows[i], parsed.col.primaryContact),
          phone: cell_(parsed.rows[i], parsed.col.phone),
          fax: cell_(parsed.rows[i], parsed.col.fax),
        },
        version: SCRIPT_VERSION,
      };
    }
  }

  var sheet = parsed.sheet;
  var out = [];
  var width = Math.max(parsed.headers.length, 6);
  for (var c = 0; c < width; c++) out[c] = '';

  if (parsed.col.customer >= 0) out[parsed.col.customer] = address;
  if (parsed.col.corporationNo >= 0) out[parsed.col.corporationNo] = corporationNo;
  if (parsed.col.emails >= 0) out[parsed.col.emails] = emails.join(', ');
  if (parsed.col.primaryContact >= 0) {
    out[parsed.col.primaryContact] = primaryContact;
  }
  if (parsed.col.phone >= 0) out[parsed.col.phone] = phone;
  if (parsed.col.fax >= 0) out[parsed.col.fax] = fax;

  sheet.appendRow(out);
  CacheService.getScriptCache().remove('customers:payload');

  var newRow = sheet.getLastRow();
  var customer = {
    id: String(newRow),
    name: address,
    address: address,
    corporationNo: corporationNo || null,
    emails: emails,
    primaryContact: primaryContact,
    phone: phone,
    fax: fax,
  };

  return {
    ok: true,
    created: true,
    customer: customer,
    version: SCRIPT_VERSION,
  };
}

function readSheetRows_() {
  var ss = SpreadsheetApp.openById(CUSTOMERS_SHEET_ID);
  var sheet = ss.getSheetByName(CUSTOMERS_SHEET_NAME);
  if (!sheet) {
    return {
      ok: false,
      error: 'Sheet tab not found: ' + CUSTOMERS_SHEET_NAME,
      customers: [],
      corporationNumbers: [],
    };
  }

  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 1) {
    return {
      ok: false,
      error: 'Sheet is empty.',
      customers: [],
      corporationNumbers: [],
    };
  }

  var headers = values[0].map(normalizeHeader_);
  var col = {
    customer: findColumnIndex_(headers, [
      'customer',
      'address',
      'name',
      'customeraddress',
    ]),
    corporationNo: findColumnIndex_(headers, [
      'corporationnumber',
      'corporationno',
      'corpno',
      'corporation',
    ]),
    emails: findColumnIndex_(headers, [
      'mainemail',
      'email',
      'emails',
      'mainemailaddress',
    ]),
    primaryContact: findColumnIndex_(headers, [
      'primarycontact',
      'primarycontactnumber',
      'contact',
      'contactnumber',
    ]),
    phone: findColumnIndex_(headers, ['mainphone', 'phone', 'telephone']),
    fax: findColumnIndex_(headers, ['fax']),
  };

  if (col.customer < 0) {
    return {
      ok: false,
      error:
        'Could not find a Customer / address column. Headers: ' +
        values[0].join(' | '),
      customers: [],
      corporationNumbers: [],
    };
  }

  return {
    ok: true,
    sheet: sheet,
    headers: headers,
    col: col,
    rows: values.slice(1),
    dataStartRow: 2,
  };
}

function normalizeHeader_(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findColumnIndex_(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = headers.indexOf(candidates[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function cell_(row, index) {
  if (index < 0 || !row || index >= row.length) return '';
  return String(row[index] || '').trim();
}

function parseEmails_(raw) {
  if (!raw) return [];
  var parts = String(raw).split(/[,;]+/);
  var seen = {};
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var email = parts[i].trim().toLowerCase();
    if (!email || seen[email] || email.indexOf('@') < 0) continue;
    seen[email] = true;
    out.push(email);
  }
  return out;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
