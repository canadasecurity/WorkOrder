import { COMPANY } from './constants.js?v=11';

const PAGE_WIDTH = 816;

export function showPreview(state) {
  renderPreview(state);
  document.getElementById('step-form')?.classList.remove('active');
  document.getElementById('step-preview')?.classList.add('active');
  document.body.classList.add('preview-mode');
  requestAnimationFrame(() => {
    scalePreviewToFit();
    requestAnimationFrame(scalePreviewToFit);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function hidePreview() {
  document.getElementById('step-preview')?.classList.remove('active');
  document.getElementById('step-form')?.classList.add('active');
  document.body.classList.remove('preview-mode');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function initPreviewControls({ onBack, onSend }) {
  document.getElementById('btnBackToForm')?.addEventListener('click', onBack);
  document.getElementById('btnSendWorkOrder')?.addEventListener('click', onSend);
  window.addEventListener('resize', scalePreviewToFit);
}

function renderPreview(state) {
  const root = document.getElementById('woPreviewRoot');
  if (!root) return;

  const services = COMPANY.services.map((s) => `• ${s}`).join('  ');
  const matsLeft = padMaterials((state.materials || []).slice(0, 5), 5);
  const matsRight = padMaterials((state.materials || []).slice(5, 10), 5);

  root.innerHTML = `
    <div class="wo-page" id="woPage">
      <header class="wo-header">
        <img class="wo-logo" src="assets/csg-logo-cropped.png" alt="Canada Security Group" />
        <div class="wo-company">
          <h1 class="wo-company-name">${escapeHtml(COMPANY.name)}</h1>
          <p class="wo-company-line">${escapeHtml(COMPANY.address)}</p>
          <p class="wo-company-line">${escapeHtml(COMPANY.city)}</p>
          <p class="wo-company-line contact">${COMPANY.phone ? `Tel: ${escapeHtml(COMPANY.phone)} | ` : ''}${escapeHtml(COMPANY.email)}</p>
          <p class="wo-company-line contact">Guard Service ${escapeHtml(COMPANY.guardService)} | 24/7 Emergency - ${escapeHtml(COMPANY.emergency)}</p>
        </div>
        <div class="wo-meta">
          <div class="wo-meta-label">WORK ORDER</div>
          <div class="wo-number-box">${escapeHtml(state.workOrderNumber || '')}</div>
        </div>
      </header>

      <div class="wo-services">${services}</div>

      <div class="wo-body">
        <div class="wo-top">
          <div class="wo-client-col">
            <div class="wo-field-row">
              <div class="wo-field-label">Client Name</div>
              <div class="wo-field-value wo-value">${escapeHtml(state.clientName)}</div>
            </div>
            <div class="wo-field-row">
              <div class="wo-field-label">Corporation No:</div>
              <div class="wo-field-value wo-value">${escapeHtml(state.corporationNo)}</div>
            </div>
            <div class="wo-field-row address">
              <div class="wo-field-label">Address:</div>
              <div class="wo-field-value wo-value">${escapeHtml(state.address)}</div>
            </div>
            <div class="wo-po-date">
              <div class="wo-field-row">
                <div class="wo-field-label">PO#</div>
                <div class="wo-field-value wo-value">${escapeHtml(state.poNumber)}</div>
              </div>
              <div class="wo-field-row">
                <div class="wo-field-label">Date:</div>
                <div class="wo-field-value wo-value">${escapeHtml(formatDate(state.date))}</div>
              </div>
            </div>
          </div>
          <div class="wo-reco">
            <div class="wo-reco-label">Recommendation:</div>
            <div class="wo-ruled">
              <div class="wo-value">${escapeHtml(state.recommendation)}</div>
            </div>
          </div>
        </div>

        <div class="wo-job">
          <span class="wo-job-label">Job Description</span>
          <div class="wo-ruled">
            <div class="wo-value">${escapeHtml(state.jobDescription)}</div>
          </div>
        </div>

        <div class="wo-materials">
          ${materialsTable(matsLeft)}
          <div class="wo-mat-gutter" aria-hidden="true"></div>
          ${materialsTable(matsRight)}
        </div>

        <table class="wo-time-table">
          <thead>
            <tr>
              <th class="c-date">Date</th>
              <th class="c-tech">Technician</th>
              <th class="c-start">Start Time</th>
              <th class="c-end">End Time</th>
              <th class="c-total">Total Hours</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(formatDate(state.serviceDate))}</td>
              <td>${escapeHtml(state.technician)}</td>
              <td>${escapeHtml(state.startTime)}</td>
              <td>${escapeHtml(state.endTime)}</td>
              <td>${escapeHtml(state.totalHours)}</td>
            </tr>
            <tr>
              <td></td><td></td><td></td><td></td><td></td>
            </tr>
          </tbody>
        </table>

        <div class="wo-sign">
          <div class="wo-sign-tech">
            <div class="wo-sign-tech-label">Technician</div>
            ${signatureImg(state.technicianSignature)}
          </div>
          <div class="wo-sign-customer">
            <div class="wo-sign-line">
              <span class="wo-sign-line-label">Customer Name:</span>
              <span class="wo-sign-line-value">${escapeHtml(state.customerName)}</span>
            </div>
            <div class="wo-sign-line">
              <span class="wo-sign-line-label">Customer Signature:</span>
              <span class="wo-sign-line-value">${signatureImg(state.customerSignature)}</span>
            </div>
          </div>
        </div>
      </div>

      <p class="wo-footer-tagline">${escapeHtml(COMPANY.footerTagline)}</p>
    </div>
  `;
}

function padMaterials(rows, count) {
  const padded = [...rows];
  while (padded.length < count) padded.push({ qty: '', name: '' });
  return padded.slice(0, count);
}

function materialsTable(rows) {
  const body = rows
    .map(
      (row) => `
      <tr>
        <td class="col-qty">${escapeHtml(row.qty || '')}</td>
        <td>${escapeHtml(row.name || '')}</td>
      </tr>`
    )
    .join('');

  return `
    <table class="wo-mat-table">
      <thead>
        <tr>
          <th class="col-qty">Qty</th>
          <th>Materials</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function signatureImg(dataUrl) {
  if (!dataUrl) return '';
  return `<img class="wo-sign-img" src="${dataUrl}" alt="Signature" />`;
}

function formatDate(value) {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function scalePreviewToFit() {
  const wrap = document.getElementById('previewScaleWrap');
  const viewport = document.getElementById('previewViewport');
  const page = document.getElementById('woPage');
  if (!wrap || !viewport || !page) return;
  if (!document.getElementById('step-preview')?.classList.contains('active')) {
    return;
  }

  const available = viewport.clientWidth;
  const scale = Math.min(1, available / PAGE_WIDTH);
  wrap.style.transform = `scale(${scale})`;
  wrap.style.width = `${PAGE_WIDTH}px`;
  wrap.style.height = `${page.offsetHeight * scale}px`;
}
