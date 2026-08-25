/**
 * Generate year-based work order numbers from server.
 * Format: YYXXX where YY = last 2 digits of current year, XXX = sequence (001+)
 * Example: 26001 (2026, sequence 001), 27001 (2027, sequence 001)
 * Counter is stored and incremented on the server for consistency across all devices.
 */

/** Returns the next work order number (fetches from server and increments). */
export async function getNextWorkOrderNumber() {
  try {
    const sequence = await fetchNextSequenceFromServer();
    return formatWorkOrderNumber(sequence);
  } catch (error) {
    console.error('Failed to get work order number from server:', error);
    throw new Error('Could not generate work order number. Please try again.');
  }
}

/** Peek at current number without incrementing (fetches from server). */
export async function peekWorkOrderNumber() {
  try {
    const sequence = await fetchCurrentSequenceFromServer();
    return formatWorkOrderNumber(sequence);
  } catch (error) {
    console.error('Failed to peek work order number:', error);
    // Fallback to a placeholder if server is unavailable
    return '26???';
  }
}

/**
 * Fetch the current sequence number from server without incrementing.
 */
async function fetchCurrentSequenceFromServer() {
  const year = new Date().getFullYear();
  
  const response = await fetch('/api/work-order/peek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok || typeof data.sequence !== 'number') {
    throw new Error('Invalid response from server');
  }

  return data.sequence;
}

/**
 * Fetch the next sequence number from server and increment it.
 */
async function fetchNextSequenceFromServer() {
  const year = new Date().getFullYear();
  
  const response = await fetch('/api/work-order/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok || typeof data.sequence !== 'number') {
    throw new Error('Invalid response from server');
  }

  return data.sequence;
}

/**
 * Format the work order number as YYXXX
 * YY = last 2 digits of current year
 * XXX = sequence number (can be any length: 001, 0001, etc.)
 */
function formatWorkOrderNumber(sequence) {
  const year = new Date().getFullYear();
  const lastTwoDigits = String(year).slice(-2);
  const paddedSequence = String(sequence).padStart(3, '0');
  return `${lastTwoDigits}${paddedSequence}`;
}

/** Reserve the displayed number on successful submit (called later). */
export function confirmWorkOrderUsed() {
  // Already handled by fetchNextSequenceFromServer()
  // This function is kept for compatibility but no additional action needed
}
