import { DEFAULT_NOTIFY_EMAIL } from './constants.js?v=21';
import { findCustomerById } from './customers.js';
import { scalePreviewToFit } from './preview.js';

/**
 * Build recipient list from selected customer + default notify email.
 * Multiple sheet emails (comma-separated) are already split in customers.js.
 * Always includes DEFAULT_NOTIFY_EMAIL.
 */
export function resolveRecipients(formState) {
  const customer = formState.customerId
    ? findCustomerById(formState.customerId)
    : null;
  const customerEmails = customer?.emails || [];
  const defaults = String(DEFAULT_NOTIFY_EMAIL || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  const all = [...customerEmails, ...defaults];
  return [...new Set(all.map((e) => e.toLowerCase()))];
}

/**
 * Snapshot #woPage with html2canvas and wrap in a single-page PDF (jsPDF).
 * Looks identical to the on-screen preview.
 */
export async function captureWorkOrderPdf(formState) {
  const page = document.getElementById('woPage');
  if (!page) throw new Error('Work order preview is not on screen.');

  if (typeof html2canvas !== 'function') {
    throw new Error('html2canvas failed to load. Hard-refresh the page.');
  }
  const jsPdfNS = window.jspdf;
  if (!jsPdfNS?.jsPDF) {
    throw new Error('jsPDF failed to load. Hard-refresh the page.');
  }

  const wrap = document.getElementById('previewScaleWrap');
  const prevTransform = wrap?.style.transform ?? '';
  const prevHeight = wrap?.style.height ?? '';

  // Capture at full 816px width (not the scaled mobile view)
  if (wrap) {
    wrap.style.transform = 'scale(1)';
    wrap.style.height = `${page.offsetHeight}px`;
  }

  let canvas;
  try {
    // Let layout settle after resetting scale
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: page.scrollWidth,
      height: page.scrollHeight,
      windowWidth: page.scrollWidth,
      windowHeight: page.scrollHeight,
    });
  } finally {
    if (wrap) {
      wrap.style.transform = prevTransform;
      wrap.style.height = prevHeight;
    }
    scalePreviewToFit();
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdfWidth = 612; // letter width in pt
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  const { jsPDF } = jsPdfNS;
  const pdf = new jsPDF({
    orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
    unit: 'pt',
    format: [pdfWidth, pdfHeight],
    compress: true,
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');

  const dataUri = pdf.output('datauristring');
  const pdfBase64 = dataUri.split(',')[1];
  const wo = formState?.workOrderNumber || 'CSG';
  const pdfFilename = `Work-Order-${wo}.pdf`;

  return { pdfBase64, pdfFilename };
}

/**
 * POST to local /api/submit → Apps Script MailApp with PDF attachment.
 */
export async function submitWorkOrder(formState) {
  const customerEmails = formState.customerId
    ? findCustomerById(formState.customerId)?.emails || []
    : [];

  if (customerEmails.length === 0 && !DEFAULT_NOTIFY_EMAIL) {
    throw new Error(
      'No email found for this address, and no default notify email is configured.'
    );
  }

  let numberResponse;
  try {
    const response = await fetch('/api/work-order-number', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    numberResponse = await response.json().catch(() => ({}));
    if (!response.ok || !numberResponse.ok || !numberResponse.workOrderNumber) {
      throw new Error(
        numberResponse.error || `Number reservation failed (${response.status})`
      );
    }
  } catch (err) {
    throw new Error(`Could not reserve work-order number: ${err.message || err}`);
  }

  const submittedState = {
    ...formState,
    workOrderNumber: numberResponse.workOrderNumber,
  };
  const numberElement = document.getElementById('workOrderNumber');
  const previewNumberElement = document.querySelector('.wo-number-box');
  const previousNumber = numberElement?.textContent || '';
  const previousPreviewNumber = previewNumberElement?.textContent || '';
  if (numberElement) numberElement.textContent = submittedState.workOrderNumber;
  if (previewNumberElement) {
    previewNumberElement.textContent = submittedState.workOrderNumber;
  }

  let pdfBase64;
  let pdfFilename;
  try {
    ({ pdfBase64, pdfFilename } = await captureWorkOrderPdf(submittedState));
  } finally {
    if (numberElement) numberElement.textContent = previousNumber;
    if (previewNumberElement) {
      previewNumberElement.textContent = previousPreviewNumber;
    }
  }
  const subject = `Work Order ${submittedState.workOrderNumber} — ${
    formState.address || 'Canada Security Group'
  }`.trim();

  let res;
  try {
    res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData: submittedState,
        customerEmails,
        subject,
        pdfBase64,
        pdfFilename,
      }),
    });
  } catch {
    throw new Error(
      'Cannot reach /api/submit. Stop python http.server and run: npm run dev'
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Send API not available. Stop other servers on port 8080, then run: npm run dev'
    );
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error || `Send failed (${res.status})`);
  }

  if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
    throw new Error(payload.error || 'Mail service did not return recipients.');
  }

  return {
    ok: true,
    recipients: payload.recipients,
    remainingQuota: payload.remainingQuota,
  };
}
