// ============================================================================
// CHAINS LITE — Link (ticket) lifecycle & evaluation
//
// A link has 3 digits and lives exactly 3 draws. Draw k is checked only
// against digit k. A miss does NOT end the link. It settles on its 3rd draw:
//   0 hits LOST | 1-2 hits WON (prize) | 3 hits JACKPOT_WON
// evaluateTicketOnDraw() is pure: it never mutates its input.
// ============================================================================

import type { DrawResult, Ticket, TicketDrawRecord, TicketStatus } from './types';
import { DIGIT_MAX, DIGIT_MIN, LINK_LENGTH, TICKET_STAKE } from './constants';
import { calculatePrize } from './payouts';

let ticketSequenceCounter = 0;

function generateTicketId(): string {
  ticketSequenceCounter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `T-${Date.now().toString(36)}-${ticketSequenceCounter}-${random}`;
}

export const TERMINAL_STATUSES: readonly TicketStatus[] = ['LOST', 'WON', 'JACKPOT_WON'];

export function isTerminal(status: TicketStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function validateLinkDigits(digits: number[]): void {
  if (!Array.isArray(digits) || digits.length !== LINK_LENGTH) {
    throw new Error(`A link requires exactly ${LINK_LENGTH} digits; received ${digits?.length ?? 0}.`);
  }
  digits.forEach((digit, i) => {
    if (!Number.isInteger(digit) || digit < DIGIT_MIN || digit > DIGIT_MAX) {
      throw new Error(`Invalid digit at position ${i}: ${digit}. Digits must be integers 0-9.`);
    }
  });
}

export interface CreateTicketParams {
  digits: number[];
  startDrawIndex: number;
  createdAtDrawIndex: number;
  stake?: number;
}

export function createTicket(params: CreateTicketParams): Ticket {
  const { digits, startDrawIndex, createdAtDrawIndex } = params;
  validateLinkDigits(digits);

  return {
    id: generateTicketId(),
    digits: [...digits],
    stake: params.stake ?? TICKET_STAKE,
    status: 'WAITING',
    hits: 0,
    startDrawIndex,
    nextDrawIndex: startDrawIndex,
    createdAtDrawIndex,
    settledAtDrawIndex: null,
    prizeAmount: null,
    jackpotWinAmount: null,
    totalReturn: 0,
    drawLog: [],
  };
}

/**
 * Advances a link by exactly one global draw.
 * - Terminal links are returned unchanged.
 * - A link only reacts to the draw whose index equals its nextDrawIndex, which
 *   keeps overlapping timelines fully independent.
 * - For JACKPOT_WON the pool amount is NOT set here; the engine pays it via
 *   JackpotManager (it may be split across simultaneous winners).
 */
export function evaluateTicketOnDraw(ticket: Ticket, draw: DrawResult): Ticket {
  if (isTerminal(ticket.status)) return ticket;
  if (draw.drawIndex !== ticket.nextDrawIndex) return ticket;

  const position = ticket.drawLog.length;
  const matched = draw.digit === ticket.digits[position];
  const drawLog: TicketDrawRecord[] = [
    ...ticket.drawLog,
    { drawIndex: draw.drawIndex, digit: draw.digit, matched },
  ];
  const hits = ticket.hits + (matched ? 1 : 0);
  const nextDrawIndex = draw.drawIndex + 1;

  if (drawLog.length < LINK_LENGTH) {
    return { ...ticket, status: 'ACTIVE', hits, nextDrawIndex, drawLog };
  }

  // Third draw: settle.
  const settled = { ...ticket, hits, nextDrawIndex, drawLog, settledAtDrawIndex: draw.drawIndex };
  if (hits === LINK_LENGTH) return { ...settled, status: 'JACKPOT_WON' };
  if (hits === 0) return { ...settled, status: 'LOST' };

  const prizeAmount = calculatePrize(hits, ticket.stake);
  return { ...settled, status: 'WON', prizeAmount, totalReturn: prizeAmount };
}

/** Flips WAITING links whose start draw has been reached to ACTIVE (display
 * accuracy only; evaluation treats WAITING and ACTIVE identically). */
export function activateDueTickets(tickets: Ticket[], currentDrawIndex: number): Ticket[] {
  let changed = false;
  const next = tickets.map((ticket) => {
    if (ticket.status === 'WAITING' && currentDrawIndex >= ticket.startDrawIndex) {
      changed = true;
      return { ...ticket, status: 'ACTIVE' as TicketStatus };
    }
    return ticket;
  });
  return changed ? next : tickets;
}