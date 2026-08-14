import { WORK_ORDER } from './constants.js?v=11';

/** Returns the next work order number and persists the counter. */
export function getNextWorkOrderNumber() {
  const key = WORK_ORDER.storageKey;
  let next = parseInt(localStorage.getItem(key) || '', 10);
  if (Number.isNaN(next)) {
    next = WORK_ORDER.startNumber;
  }
  const display = formatWorkOrderNumber(next);
  localStorage.setItem(key, String(next + 1));
  return display;
}

/** Peek at current number without incrementing (for display on load). */
export function peekWorkOrderNumber() {
  const key = WORK_ORDER.storageKey;
  let next = parseInt(localStorage.getItem(key) || '', 10);
  if (Number.isNaN(next)) {
    next = WORK_ORDER.startNumber;
  }
  return formatWorkOrderNumber(next);
}

function formatWorkOrderNumber(num) {
  const { prefix, padLength } = WORK_ORDER;
  const numeric =
    padLength > 0 ? String(num).padStart(padLength, '0') : String(num);
  return `${prefix}${numeric}`;
}

/** Reserve the displayed number on successful submit (called later). */
export function confirmWorkOrderUsed() {
  const key = WORK_ORDER.storageKey;
  const current = parseInt(localStorage.getItem(key) || '', 10);
  if (!Number.isNaN(current)) return;
  localStorage.setItem(key, String(WORK_ORDER.startNumber + 1));
}
