/**
 * Application constants — edit values here without touching form logic.
 */
export const COMPANY = {
  name: 'CANADA SECURITY GROUP',
  address: '4 Robert Speck Pkwy, Suite 1509',
  city: 'Mississauga ON L4Z 1S1',
  email: 'info@canadasecuritygroup.com',
  guardService: '416 819 6123',
  emergency: '416 670 1664',
  services: [
    'Access Systems',
    'CCTV',
    'Telephone Entry',
    'IT Solutions',
    'Uniformed Security',
  ],
  footerTagline:
    'We provide FOB/Remote and security credential for best market price',
};

/** Work order number generation settings */
export const WORK_ORDER = {
  /** Optional prefix before the number (e.g. "WO-") */
  prefix: '',
  /** Starting number when no prior work order exists in this browser */
  startNumber: 2411551,
  /** Pad numeric portion to this length (0 = no padding) */
  padLength: 7,
  /** localStorage key used to persist the next work order number */
  storageKey: 'csp_work_order_counter',
};

/**
 * Technician names shown in the dropdown.
 * Add or remove names here — the form rebuilds the list on load.
 */
export const TECHNICIANS = ['Lehri', 'Ariel', 'Cliff', 'Chris'];

/**
 * Always receives a copy of every work order.
 * Also used alone when the selected customer has no Main email in the Sheet.
 */
export const DEFAULT_NOTIFY_EMAIL = 'accounts@canadasecuritygroup.com';

/**
 * Google Apps Script Web App /exec URL (see google-apps-script/DEPLOY.md).
 * Deploy from accounts@canadasecuritygroup.com, then paste the new /exec URL here
 * and in .env (restart npm run dev after).
 */
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzVWwda2JnDGTX6FFtw9ghR6JBC8l7v4MOQPBeMwsPQX9uAVv1Qk9JC2icysHrZEjtk/exec';

/** Customer list + create endpoint (Node proxy → Apps Script → Sheet) */
export const CUSTOMERS_DATA_URL = '/api/customers';
