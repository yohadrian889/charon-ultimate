/**
 * PROFIT LOCK SYSTEM
 * 
 * Dynamic exit strategy that locks profits progressively as price rises.
 * No fixed TP — lets winners run while protecting against reversals.
 * 
 * Tiered lock levels:
 * - +15% → lock at +5%
 * - +40% → lock at +20%
 * - +80% → lock at +50%
 * - +80%+ → dynamic lock = highWatermark - 30%
 */

import { now } from '../utils.js';
import { db } from '../db/connection.js';
import { numSetting } from '../db/settings.js';

// Profit lock tiers — each threshold triggers a higher floor
const PROFIT_TIERS = [
  { threshold: 0.15, lock: 0.05 },   // +15% → lock at +5%
  { threshold: 0.40, lock: 0.20 },   // +40% → lock at +20%
  { threshold: 0.80, lock: 0.50 },   // +80% → lock at +50%
];

// Configurable initial stop-loss
const DEFAULT_INITIAL_SL = -0.20; // -20%

/**
 * Calculate the current profit lock level based on PnL and peak watermark
 * 
 * @param {number} pnlPercent - Current PnL as decimal (e.g., 0.15 = +15%)
 * @param {number} peakPnlPercent - Highest PnL achieved as decimal
 * @returns {number} - The lock level (minimum exit percentage)
 */
export function calculateProfitLock(pnlPercent, peakPnlPercent) {
  let lockLevel = null;
  
  // Check static tiers first
  for (const tier of PROFIT_TIERS) {
    if (pnlPercent >= tier.threshold) {
      lockLevel = tier.lock;
    }
  }
  
  // Above +80%, use dynamic lock: peak - 30%
  if (pnlPercent > 0.80) {
    return Math.max(peakPnlPercent - 0.30, lockLevel);
  }
  
  return lockLevel;
}

/**
 * Calculate current PnL percentage from entry and current values
 */
export function calculatePnL(entryMcap, currentMcap) {
  if (!entryMcap || entryMcap <= 0) return null;
  return (currentMcap / entryMcap) - 1;
}

/**
 * Determine if position should exit based on profit lock logic
 * 
 * @param {object} position - Position object from database
 * @param {number} currentMcap - Current market cap
 * @param {number} highWaterMcap - Highest market cap achieved
 * @returns {object} - { shouldExit, exitReason, lockLevel }
 */
export function shouldExitWithProfitLock(position, currentMcap, highWaterMcap) {
  const entryMcap = Number(position.entry_mcap);
  if (!entryMcap || entryMcap <= 0) return { shouldExit: false, exitReason: null, lockLevel: null };
  
  const pnlPercent = calculatePnL(entryMcap, currentMcap);
  if (pnlPercent === null) return { shouldExit: false, exitReason: null, lockLevel: null };
  
  const highWatermarkPnL = calculatePnL(entryMcap, highWaterMcap);
  
  // Check initial stop-loss first
  const initialSL = Number(position.sl_percent) || DEFAULT_INITIAL_SL;
  if (pnlPercent <= initialSL) {
    return { shouldExit: true, exitReason: 'SL', lockLevel: pnlPercent };
  }
  
  // Calculate profit lock
  const lockLevel = calculateProfitLock(pnlPercent, highWatermarkPnL);
  
  if (lockLevel === null) {
    // Below first threshold — no lock yet, don't exit unless SL hit
    return { shouldExit: false, exitReason: null, lockLevel: null };
  }
  
  // Check if current PnL dropped to or below lock level
  if (pnlPercent <= lockLevel) {
    return { shouldExit: true, exitReason: 'PROFIT_LOCK', lockLevel: pnlPercent };
  }
  
  return { shouldExit: false, exitReason: null, lockLevel: pnlPercent };
}

/**
 * Get profit lock status for a position (for display)
 */
export function getProfitLockStatus(position, currentMcap, highWaterMcap) {
  const entryMcap = Number(position.entry_mcap);
  if (!entryMcap || entryMcap <= 0) return null;
  
  const pnlPercent = calculatePnL(entryMcap, currentMcap);
  const highWatermarkPnL = calculatePnL(entryMcap, highWaterMcap);
  const lockLevel = calculateProfitLock(pnlPercent, highWatermarkPnL);
  
  // Find which tier is active
  let activeTier = null;
  for (const tier of PROFIT_TIERS) {
    if (pnlPercent >= tier.threshold) {
      activeTier = tier;
    }
  }
  
  function getNextTier(pnl) {
    for (const tier of PROFIT_TIERS) {
      if (pnl < tier.threshold) {
        return `+${(tier.threshold * 100).toFixed(0)}% → lock at +${(tier.lock * 100).toFixed(0)}%`;
      }
    }
    return pnlPercent > 0.80 ? 'Dynamic (high - 30%)' : 'None';
  }
  
  return {
    pnlPercent: pnlPercent !== null ? (pnlPercent * 100).toFixed(2) + '%' : 'N/A',
    highWatermarkPnL: highWatermarkPnL !== null ? (highWatermarkPnL * 100).toFixed(2) + '%' : 'N/A',
    currentLock: lockLevel !== null ? (lockLevel * 100).toFixed(2) + '%' : 'None',
    activeTier: activeTier ? `+${(activeTier.threshold * 100).toFixed(0)}% → +${(activeTier.lock * 100).toFixed(0)}%` : 'Below first tier',
    nextTier: getNextTier(pnlPercent),
    dynamicAbove80: pnlPercent > 0.80 && highWatermarkPnL ? `Lock: ${((highWatermarkPnL - 0.30) * 100).toFixed(0)}%` : null,
  };
}

/**
 * Check all open positions for profit lock exits
 * Called by position monitor loop
 */
export async function checkProfitLockExits() {
  const positions = db.prepare('SELECT * FROM dry_run_positions WHERE status = ?').all('open');
  const results = [];
  
  for (const position of positions) {
    const highWaterMcap = Number(position.high_water_mcap || position.entry_mcap || 0);
    
    // Get current price from Jupiter
    const { fetchJupiterAsset } = await import('./enrichment/jupiter.js');
    const asset = await fetchJupiterAsset(position.mint);
    const currentMcap = Number(asset?.mcap || asset?.fdv || 0);
    
    if (!currentMcap || currentMcap <= 0) continue;
    
    const { shouldExit, exitReason, lockLevel } = shouldExitWithProfitLock(position, currentMcap, highWaterMcap);
    
    if (shouldExit) {
      results.push({
        positionId: position.id,
        mint: position.mint,
        symbol: position.symbol,
        exitReason,
        lockLevel,
        pnl: ((currentMcap / Number(position.entry_mcap)) - 1) * 100,
      });
    }
  }
  
  return results;
}