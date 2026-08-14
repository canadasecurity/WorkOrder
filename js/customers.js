import { CUSTOMERS_DATA_URL } from './constants.js?v=20';

let customers = [];
let corporationNumbers = [];

export async function loadCustomers() {
  const res = await fetch(CUSTOMERS_DATA_URL);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(
      data.error ||
        'Failed to load customers from Google Sheet. Deploy Apps Script and set APPS_SCRIPT_URL.'
    );
  }
  if (!Array.isArray(data.customers)) {
    throw new Error(
      'Customer list missing from API response. Redeploy Apps Script with ?action=customers support.'
    );
  }
  customers = data.customers;
  corporationNumbers = data.corporationNumbers || [];
  return { customers, corporationNumbers };
}

/**
 * Append (or return existing) customer row in ContactDetails via Apps Script.
 */
export async function addCustomerToSheet(payload) {
  const res = await fetch(CUSTOMERS_DATA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok || !data.customer) {
    throw new Error(data.error || 'Failed to save customer to Google Sheet');
  }

  const customer = data.customer;
  const existingIdx = customers.findIndex((c) => c.id === customer.id);
  if (existingIdx >= 0) {
    customers[existingIdx] = customer;
  } else if (!customers.some((c) => c.address === customer.address)) {
    customers.push(customer);
  }

  const corp = customer.corporationNo;
  if (corp && !corporationNumbers.includes(corp)) {
    corporationNumbers = [...corporationNumbers, corp].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );
  }

  return { customer, alreadyExists: !!data.alreadyExists };
}

export function getCustomers() {
  return customers;
}

export function getCorporationNumbers() {
  return corporationNumbers;
}

export function findCustomerById(id) {
  return customers.find((c) => c.id === id) || null;
}

export function findCustomerByAddress(address) {
  return customers.find((c) => c.address === address || c.name === address) || null;
}

export function findCustomerByCorpNo(corpNo) {
  if (!corpNo) return null;
  return customers.find((c) => c.corporationNo === corpNo) || null;
}

export function populateAddressSelect(selectEl) {
  selectEl.innerHTML = '<option value="">Search address…</option>';
  customers.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.address || c.name;
    selectEl.appendChild(opt);
  });
}

export function populateCorpNoSelect(selectEl) {
  selectEl.innerHTML = '<option value="">— Select corp no —</option>';
  corporationNumbers.forEach((corp) => {
    const opt = document.createElement('option');
    opt.value = corp;
    opt.textContent = corp;
    selectEl.appendChild(opt);
  });
}
