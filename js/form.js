import { COMPANY, TECHNICIANS } from './constants.js?v=20';
import {
  loadCustomers,
  addCustomerToSheet,
  populateAddressSelect,
  populateCorpNoSelect,
  findCustomerById,
  findCustomerByAddress,
  findCustomerByCorpNo,
} from './customers.js';
import { peekWorkOrderNumber, getNextWorkOrderNumber } from './work-order.js';
import { collectFormState, saveFormState, loadFormState } from './form-state.js';
import { showPreview, hidePreview, initPreviewControls } from './preview.js';
import { submitWorkOrder, resolveRecipients } from './submit.js';

let addressSelect;
let corpSelect;
let syncing = false;
let isSending = false;

export async function initForm() {
  renderHeader();
  document.getElementById('workOrderNumber').textContent = peekWorkOrderNumber();
  setDefaultDates();
  populateTechnicians();
  await initCustomerFields();
  initSignaturePads();
  initTimePickers();
  initTimeCalculation();
  bindEvents();
  initPreviewControls({
    onBack: () => hidePreview(),
    onSend: () => handleSend(),
  });
}

async function handleSend() {
  if (isSending) return;

  const state = loadFormState();
  if (!state) {
    alert('Form data is missing. Please go back and fill the form again.');
    return;
  }

  const recipients = resolveRecipients(state);
  if (recipients.length === 0) {
    alert(
      'No email address found for this customer, and no default notify email is set in constants.js.'
    );
    return;
  }

  const confirmed = window.confirm(
    `Send this work order to:\n\n${recipients.join('\n')}\n\nContinue?`
  );
  if (!confirmed) return;

  const btn = document.getElementById('btnSendWorkOrder');
  const originalLabel = btn?.textContent || 'Send / Submit';
  isSending = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  try {
    const result = await submitWorkOrder(state);
    // Advance work order number only after a successful send
    getNextWorkOrderNumber();
    document.getElementById('workOrderNumber').textContent =
      peekWorkOrderNumber();

    alert(
      `Work order sent successfully!\n\nSent to:\n${(result.recipients || recipients).join('\n')}`
    );
    hidePreview();
    document.getElementById('workOrderForm')?.reset();
    setDefaultDates();
    addressSelect?.clear?.(true);
    corpSelect?.clear?.(true);
    document.getElementById('technician')?.tomselect?.clear?.(true);
    document.getElementById('corporationNo').value = '';
    document.getElementById('clearTechnicianSig')?.click();
    document.getElementById('clearCustomerSig')?.click();
    sessionStorage.removeItem('wo_form_state');
  } catch (err) {
    console.error(err);
    alert(`Could not send work order:\n${err.message || err}`);
  } finally {
    isSending = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

function renderHeader() {
  const el = document.getElementById('companyHeader');
  if (!el) return;
  el.innerHTML = `
    <div class="company-name">${COMPANY.name}</div>
    <div class="small opacity-75">${COMPANY.address}, ${COMPANY.city}</div>
    <div class="small opacity-75">${COMPANY.email}</div>
    <div class="small opacity-75">Guard Service ${COMPANY.guardService} · 24/7 Emergency ${COMPANY.emergency}</div>
  `;
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('formDate').value = today;
  document.getElementById('serviceDate').value = today;
}

function populateTechnicians() {
  const select = document.getElementById('technician');
  if (!select) {
    console.error('Technician select #technician not found');
    return;
  }

  const names = Array.isArray(TECHNICIANS)
    ? TECHNICIANS.map((n) => String(n).trim()).filter(Boolean)
    : [];

  // Rebuild from constants.js (source of truth)
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select technician…';
  select.appendChild(placeholder);

  names.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  // Use Tom Select so options are clearly visible (same UX as Address)
  if (window.TomSelect) {
    if (select.tomselect) {
      select.tomselect.destroy();
    }
    new TomSelect(select, {
      create: false,
      allowEmptyOption: true,
      placeholder: 'Select technician…',
      maxOptions: null,
    });
  }

  if (names.length === 0) {
    console.warn('TECHNICIANS is empty in js/constants.js');
  } else {
    console.info('Technician options loaded:', names.join(', '));
  }
}

async function initCustomerFields() {
  try {
    await loadCustomers();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Could not load customer data from Google Sheet.');
  }

  const addressEl = document.getElementById('addressSelect');
  const corpEl = document.getElementById('corpNoSelect');
  populateAddressSelect(addressEl);
  populateCorpNoSelect(corpEl);

  if (window.TomSelect) {
    addressSelect = new TomSelect('#addressSelect', {
      create: true,
      createOnBlur: false,
      persist: true,
      sortField: { field: 'text', direction: 'asc' },
      placeholder: 'Search or add address…',
      allowEmptyOption: true,
      render: {
        option_create(data, escape) {
          return `<div class="create">Add address <strong>${escape(data.input)}</strong> to sheet…</div>`;
        },
      },
      create(input, callback) {
        createAddressOnSheet(input)
          .then((customer) => {
            if (!customer) {
              callback();
              return;
            }
            callback({ value: customer.id, text: customer.address || customer.name });
            if (customer.corporationNo && corpSelect) {
              if (!corpSelect.options[customer.corporationNo]) {
                corpSelect.addOption({
                  value: customer.corporationNo,
                  text: customer.corporationNo,
                });
              }
            }
          })
          .catch((err) => {
            console.error(err);
            alert(err.message || 'Could not add address to sheet.');
            callback();
          });
      },
      onChange() {
        onAddressChange();
      },
    });

    corpSelect = new TomSelect('#corpNoSelect', {
      create: true,
      sortField: { field: 'text', direction: 'asc' },
      placeholder: 'Search or type corp no…',
      allowEmptyOption: true,
      createOnBlur: true,
      persist: false,
      onChange() {
        onCorpChange();
      },
    });
  } else {
    addressEl.addEventListener('change', onAddressChange);
    corpEl.addEventListener('change', onCorpChange);
  }
}

/**
 * Modal → POST /api/customers → append ContactDetails row.
 * Returns the customer object, or null if cancelled.
 */
function createAddressOnSheet(rawAddress) {
  const address = String(rawAddress || '').trim();
  if (!address) return Promise.resolve(null);

  const existing = findCustomerByAddress(address);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const modalEl = document.getElementById('newCustomerModal');
    const addressInput = document.getElementById('newCustomerAddress');
    const corpInput = document.getElementById('newCustomerCorp');
    const emailInput = document.getElementById('newCustomerEmail');
    const contactInput = document.getElementById('newCustomerContact');
    const phoneInput = document.getElementById('newCustomerPhone');
    const faxInput = document.getElementById('newCustomerFax');
    const errorEl = document.getElementById('newCustomerError');
    const saveBtn = document.getElementById('newCustomerSave');

    if (!modalEl || !window.bootstrap?.Modal) {
      resolve(null);
      return;
    }

    addressInput.value = address;
    corpInput.value =
      document.getElementById('corporationNo')?.value ||
      document.getElementById('corpNoSelect')?.value ||
      '';
    emailInput.value = '';
    contactInput.value = '';
    phoneInput.value = '';
    faxInput.value = '';
    errorEl.classList.add('d-none');
    errorEl.textContent = '';
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to sheet';

    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    let settled = false;

    const cleanup = () => {
      saveBtn.removeEventListener('click', onSave);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    };

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onHidden = () => finish(null);

    const onSave = async () => {
      errorEl.classList.add('d-none');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        const { customer } = await addCustomerToSheet({
          address: addressInput.value.trim(),
          corporationNo: corpInput.value.trim(),
          emails: emailInput.value.trim(),
          primaryContact: contactInput.value.trim(),
          phone: phoneInput.value.trim(),
          fax: faxInput.value.trim(),
        });

        // Keep corp field in sync if user set it in the modal
        if (customer.corporationNo) {
          syncing = true;
          document.getElementById('corporationNo').value = customer.corporationNo;
          if (corpSelect) {
            if (!corpSelect.options[customer.corporationNo]) {
              corpSelect.addOption({
                value: customer.corporationNo,
                text: customer.corporationNo,
              });
            }
            corpSelect.setValue(customer.corporationNo, true);
          }
          syncing = false;
        }

        modalEl.removeEventListener('hidden.bs.modal', onHidden);
        cleanup();
        settled = true;
        modal.hide();
        resolve(customer);
      } catch (err) {
        errorEl.textContent = err.message || String(err);
        errorEl.classList.remove('d-none');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save to sheet';
      }
    };

    saveBtn.addEventListener('click', onSave);
    modalEl.addEventListener('hidden.bs.modal', onHidden);
    modal.show();
    setTimeout(() => emailInput.focus(), 300);
  });
}

function onAddressChange() {
  if (syncing) return;
  const addressEl = document.getElementById('addressSelect');
  const customer = findCustomerById(addressEl.value);
  if (!customer) return;

  syncing = true;
  const corpValue = customer.corporationNo || '';
  document.getElementById('corporationNo').value = corpValue;

  if (corpSelect) {
    if (corpValue && !corpSelect.options[corpValue]) {
      corpSelect.addOption({ value: corpValue, text: corpValue });
    }
    corpSelect.setValue(corpValue, true);
  } else {
    document.getElementById('corpNoSelect').value = corpValue;
  }
  syncing = false;
}

function onCorpChange() {
  if (syncing) return;
  const corpEl = document.getElementById('corpNoSelect');
  const corpValue = (corpEl.value || '').trim();
  document.getElementById('corporationNo').value = corpValue;

  const customer = findCustomerByCorpNo(corpValue);
  if (!customer) return;

  syncing = true;
  if (addressSelect) {
    addressSelect.setValue(customer.id, true);
  } else {
    document.getElementById('addressSelect').value = customer.id;
  }
  syncing = false;
}

function initSignaturePads() {
  createSignaturePad('technicianSignatureCanvas', 'clearTechnicianSig');
  createSignaturePad('customerSignatureCanvas', 'clearCustomerSig');
}

function createSignaturePad(canvasId, clearBtnId) {
  const canvas = document.getElementById(canvasId);
  const pad = new window.SignaturePad(canvas, {
    backgroundColor: 'rgb(255, 255, 255)',
    penColor: 'rgb(0, 0, 0)',
  });

  function resize() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = pad.isEmpty() ? null : pad.toData();
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    pad.clear();
    if (data) pad.fromData(data);
  }

  resize();
  window.addEventListener('resize', resize);

  document.getElementById(clearBtnId).addEventListener('click', () => pad.clear());

  canvas.pad = pad;
  canvas.getSignatureDataUrl = () =>
    pad.isEmpty() ? '' : pad.toDataURL('image/png');
  return pad;
}

function initTimePickers() {
  if (typeof window.mdtimepicker !== 'function') {
    console.warn('mdtimepicker not loaded — falling back to native text inputs.');
    return;
  }

  const options = {
    theme: 'blue',
    format: 'h:mm tt',
    hourPadding: true,
    clearBtn: true
  };

  ['startTime', 'endTime'].forEach((id) => {
    const input = document.getElementById(id);
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('placeholder', 'Tap to select time');
    window.mdtimepicker(input, options);
  });
}

function initTimeCalculation() {
  const start = document.getElementById('startTime');
  const end = document.getElementById('endTime');
  const total = document.getElementById('totalHours');

  function update() {
    total.value = calcTotalHours(start.value, end.value);
  }

  ['change', 'input', 'timechanged'].forEach((evt) => {
    start.addEventListener(evt, update);
    end.addEventListener(evt, update);
  });
}

/** Accepts "14:30" or "02:30 PM" style values. */
function toMinutes(value) {
  if (!value) return null;
  const trimmed = value.trim();

  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }

  return null;
}

function calcTotalHours(start, end) {
  const startMin = toMinutes(start);
  const endMinRaw = toMinutes(end);
  if (startMin === null || endMinRaw === null) return '';

  let endMin = endMinRaw;
  if (endMin < startMin) endMin += 24 * 60;
  return ((endMin - startMin) / 60).toFixed(2);
}

function bindEvents() {
  const form = document.getElementById('workOrderForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm(form)) return;

    const state = collectFormState(form);
    state.technicianSignature =
      document
        .getElementById('technicianSignatureCanvas')
        ?.getSignatureDataUrl?.() || '';
    state.customerSignature =
      document
        .getElementById('customerSignatureCanvas')
        ?.getSignatureDataUrl?.() || '';

    saveFormState(state);
    showPreview(state);
  });
}

function validateForm(form) {
  form.classList.add('was-validated');

  const addressId =
    addressSelect?.getValue?.() ||
    form.querySelector('#addressSelect').value ||
    '';
  const date = form.querySelector('#formDate').value;
  const jobDescription = form.querySelector('#jobDescription').value.trim();
  const technician =
    form.querySelector('#technician')?.tomselect?.getValue?.() ||
    form.querySelector('#technician')?.value ||
    '';
  const customerName = form.querySelector('#customerName').value.trim();
  const materialsFeedback = document.getElementById('materialsFeedback');
  const materialsCard = document.getElementById('materialsCard');

  if (!addressId) {
    alert('Please select an address.');
    addressSelect?.focus();
    return false;
  }
  if (!date) {
    alert('Please select a date.');
    form.querySelector('#formDate').focus();
    return false;
  }
  if (!jobDescription) {
    alert('Please enter a job description.');
    form.querySelector('#jobDescription').focus();
    return false;
  }
  if (!technician) {
    alert('Please select a technician.');
    form.querySelector('#technician')?.tomselect?.focus();
    return false;
  }
  if (!customerName) {
    alert('Please enter the customer name.');
    form.querySelector('#customerName').focus();
    return false;
  }
  materialsFeedback?.classList.add('d-none');
  materialsFeedback?.classList.remove('d-block');
  materialsCard?.classList.remove('materials-invalid');
  return true;
}

function startForm() {
  initForm().catch((err) => {
    console.error(err);
    alert(
      'Failed to load form. Make sure you run a local server (python -m http.server 8080).'
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startForm);
} else {
  startForm();
}
