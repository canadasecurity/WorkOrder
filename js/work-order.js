/**
 * Generate year-based work order numbers.
 * Format: YYXXX where YY = last 2 digits of current year, XXX = sequence (001-999)
 * Example: 26001 (2026, sequence 001), 27001 (2027, sequence 001)
 * Automatically resets to XXX001 on January 1st of each year.
 */

/** Returns the next work order number and persists the counter. */
export function getNextWorkOrderNumber() {
  const next = getNextSequenceNumber();
  const display = formatWorkOrderNumber(next);
  return display;
}

/** Peek at current number without incrementing (for display on load). */
export function peekWorkOrderNumber() {
  const current = getCurrentSequenceNumber();
  return formatWorkOrderNumber(current);
}

/**
 * Get the current sequence number for the year.
 * Returns the next number that will be used (without incrementing).
 */
function getCurrentSequenceNumber() {
  const key = getStorageKey();
  let sequence = parseInt(localStorage.getItem(key) || '', 10);
  
  if (Number.isNaN(sequence)) {
    sequence = 1; // First work order of the year
  }
  
  return sequence;
}

/**
 * Get the next sequence number and increment the counter.
 */
function getNextSequenceNumber() {
  const key = getStorageKey();
  let sequence = parseInt(localStorage.getItem(key) || '', 10);
  
  if (Number.isNaN(sequence)) {
    sequence = 1; // First work order of the year
  }
  
  const current = sequence;
  localStorage.setItem(key, String(sequence + 1));
  
  return current;
}

/**
 * Get the storage key for the current year.
 * Format: 'csp_work_order_counter_YYYY'
 */
function getStorageKey() {
  const year = new Date().getFullYear();
  return `csp_work_order_counter_${year}`;
}

/**
 * Format the work order number as YYXXX
 * YY = last 2 digits of current year
 * XXX = padded sequence number
 */
function formatWorkOrderNumber(sequence) {
  const year = new Date().getFullYear();
  const lastTwoDigits = String(year).slice(-2);
  const paddedSequence = String(sequence).padStart(3, '0');
  return `${lastTwoDigits}${paddedSequence}`;
}

/** Reserve the displayed number on successful submit (called later). */
export function confirmWorkOrderUsed() {
  // Already handled by getNextSequenceNumber()
  // This function is kept for compatibility but no additional action needed
}
