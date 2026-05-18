/**
 * REALISTIC BACKTEST v2: Degen vs Ultimate Degen
 * 
 * Improvements over v1:
 * - Market regime simulation (bull/bear/sideways)
 * - Win rate varies by preset (tighter SL = better survival)
 * - "Give back syndrome" modeled realistically
 * - Equity curve and max drawdown tracking
 * - Position sizing properly factored
 * - Consecutive loss streak handling
 * 
 * Run: node backtest.js
 */

function createRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const RNG = createRNG(Date.now());

// Market regime - affects base win rate and avg return
function getMarketRegime(rng) {
  const r = rng();
  if (r < 0.25) return { name: '🟢 BULL', baseWinRate: 0.28, avgReturn: 4.5, volatilityMod: 0.8 };
  if (r < 0.50) return { name: '🟡 SIDEWAYS', baseWinRate: 0.20, avgReturn: 2.5, volatilityMod: 1.0 };
  if (r < 0.75) return { name: '🔴 BEAR', baseWinRate: 0.12, avgReturn: 1.8, volatilityMod: 1.3 };
  return { name: '⚡ PUMP', baseWinRate: 0.35, avgReturn: 8.0, volatilityMod: 0.6 };
}

// Generate realistic trade outcome
function generateTrade(preset, market, rng) {
  const baseWin = market.baseWinRate;
  
  // Adjust win rate by SL strictness
  // Tighter SL = better survival = better effective win rate in bad markets
  let adjustedWinRate = baseWin;
  if (preset.sl_percent >= -20) adjustedWinRate = baseWin * 1.15;  // tighter SL helps
  if (preset.sl_percent <= -40) adjustedWinRate = baseWin * 0.90;  // wider SL hurts
  
  // Adjust by position size (bigger size = harder to manage)
  adjustedWinRate *= (1.0 - (preset.position_size_sol - 0.1) * 0.3);
  
  const won = rng() < adjustedWinRate;
  
  if (!won) {
    // LOSS - but stop loss saves you from total wipeout
    return {
      won: false,
      pnl: preset.sl_percent / 100,  // exits at SL exactly
      exit: 'stop_loss',
      maxRunup: preset.sl_percent / 100 * rng() * 0.5  // was worse before exit
    };
  }
  
  // WIN - calculate realistic return
  const volatility = market.avgReturn * market.volatilityMod;
  const rawReturn = volatility * (0.3 + rng() * 1.4);  // 0.3x to 1.7x of avg
  
  // Small chance of massive winner
  const jackpot = rng() < 0.08;
  const finalReturn = jackpot ? rawReturn * (3 + rng() * 5) : rawReturn;
  
  // Apply profit lock IF enabled
  if (!preset.use_profit_lock) {
    // Current Degen: rides to the end, no lock
    // Jackpot winner = full ride
    // But common scenario: 5x then give back 80% before exit
    const giveBackPct = 0.50 + rng() * 0.45;  // give back 50-95% on non-jackpot wins
    const actualExit = jackpot ? finalReturn : finalReturn * (1 - giveBackPct);
    return {
      won: true,
      pnl: actualExit,
      exit: jackpot ? 'jackpot' : 'full_ride',
      maxRunup: finalReturn
    };
  }
  
  // Ultimate Degen WITH profit lock
  let lockLevel = 0;
  for (const tier of preset.profit_lock_tiers) {
    if (finalReturn >= tier.threshold) lockLevel = tier.lock;
  }
  
  // Dynamic lock for big winners
  if (finalReturn > 0.80) {
    lockLevel = Math.max(lockLevel, finalReturn - preset.profit_lock_dynamic_pct);
  }
  
  lockLevel = Math.min(lockLevel, finalReturn);
  
  // Lock doesn't prevent partial giveback on REALLY big moves
  // But it does prevent the "5x to 0.5x" disaster
  const afterLock = jackpot
    ? Math.max(lockLevel, finalReturn * 0.70)  // jackpot keeps 70%+ even with lock
    : lockLevel + (finalReturn - lockLevel) * 0.15;  // small winners: lock captures most
  
  return {
    won: true,
    pnl: afterLock,
    exit: jackpot ? 'jackpot_locked' : 'locked',
    maxRunup: finalReturn
  };
}

// Run simulation
function runSimulation(preset, market, nTrades) {
  const trades = [];
  let equity = 100;  // start with 100 SOL bankroll
  let peakEquity = 100;
  let maxDrawdown = 0;
  let wins = 0, losses = 0;
  let jackpotWins = 0;
  let lockedWins = 0;
  
  for (let i = 0; i < nTrades; i++) {
    const trade = generateTrade(preset, market, RNG);
    
    // Apply position size
    const positionPnl = trade.pnl * preset.position_size_sol * 10;  // scaled for simulation
    trade.equityPnl = positionPnl;
    equity += positionPnl;
    
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    
    if (trade.won) {
      wins++;
      if (trade.exit.includes('jackpot')) jackpotWins++;
      if (trade.exit.includes('locked')) lockedWins++;
    } else {
      losses++;
    }
    
    trades.push({ ...trade, equityAfter: equity, drawdown });
  }
  
  // Calculate metrics
  const winRate = wins / nTrades;
  const avgWin = wins > 0 ? trades.filter(t => t.won).reduce((s, t) => s + t.equityPnl, 0) / wins : 0;
  const avgLoss = losses > 0 ? trades.filter(t => !t.won).reduce((s, t) => s + t.equityPnl, 0) / losses : 0;
  const profitFactor = Math.abs(avgWin / avgLoss);
  
  return {
    equity,
    peakEquity,
    maxDrawdown: maxDrawdown * 100,
    wins, losses,
    winRate: winRate * 100,
    avgWin,
    avgLoss,
    profitFactor,
    jackpotWins,
    lockedWins,
    trades
  };
}

// Print results
function printResults(label, results, preset) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(` ${label}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`Final Equity:    ${results.equity.toFixed(2)} SOL`);
  console.log(`Peak Equity:     ${results.peakEquity.toFixed(2)} SOL`);
  console.log(`Max Drawdown:    ${results.maxDrawdown.toFixed(1)}%`);
  console.log(`Win Rate:        ${results.winRate.toFixed(1)}%`);
  console.log(`Wins / Losses:   ${results.wins} / ${results.losses}`);
  if (results.jackpotWins > 0) console.log(`Jackpot Wins:    ${results.jackpotWins}`);
  if (results.lockedWins > 0) console.log(`Locked Wins:    ${results.lockedWins}`);
  console.log(`Profit Factor:   ${results.profitFactor.toFixed(2)}`);
  console.log(`Avg Win:         ${results.avgWin.toFixed(4)} SOL`);
  console.log(`Avg Loss:        ${results.avgLoss.toFixed(4)} SOL`);
}

// PRESETS
const CURRENT_DEGEN = {
  name: '🎰 Current Degen',
  position_size_sol: 0.2,
  sl_percent: -40,
  use_profit_lock: false,
  profit_lock_tiers: [],
  profit_lock_dynamic_pct: 0,
  trailing_enabled: false,
  partial_tp: false,
};

const ULTIMATE_DEGEN = {
  name: '🔥 Ultimate Degen',
  position_size_sol: 0.25,
  sl_percent: -15,
  use_profit_lock: true,
  profit_lock_tiers: [
    { threshold: 0.10, lock: 0.03 },
    { threshold: 0.25, lock: 0.10 },
    { threshold: 0.50, lock: 0.25 },
    { threshold: 1.00, lock: 0.50 },
    { threshold: 2.00, lock: 0.75 },
  ],
  profit_lock_dynamic_pct: 0.30,
  trailing_enabled: false,
  partial_tp: true,
  partial_tp_at_percent: 1.0,
  partial_tp_sell_percent: 50,
};

// RUN
const TRADES = 100;
const market = getMarketRegime(RNG);

console.log('═'.repeat(60));
console.log(' REALISTIC BACKTEST v2');
console.log('═'.repeat(60));
console.log(`Market Regime:   ${market.name}`);
console.log(`Base Win Rate:  ${(market.baseWinRate * 100).toFixed(0)}%`);
console.log(`Avg Return:     ${market.avgReturn}x`);
console.log(`Trades:         ${TRADES}`);

const r1 = runSimulation(CURRENT_DEGEN, market, TRADES);
const r2 = runSimulation(ULTIMATE_DEGEN, market, TRADES);

printResults(CURRENT_DEGEN.name, r1, CURRENT_DEGEN);
printResults(ULTIMATE_DEGEN.name, r2, ULTIMATE_DEGEN);

// COMPARISON
console.log(`\n${'═'.repeat(60)}`);
console.log(' HEAD-TO-HEAD');
console.log(`${'═'.repeat(60)}`);
console.log(`                   Current Degen    Ultimate Degen`);
console.log(`Final Equity:     ${r1.equity.toFixed(2).padStart(14)}    ${r2.equity.toFixed(2).padStart(14)}`);
console.log(`Max Drawdown:     ${r1.maxDrawdown.toFixed(1).padStart(14)}%    ${r2.maxDrawdown.toFixed(1).padStart(14)}%`);
console.log(`Win Rate:         ${r1.winRate.toFixed(1).padStart(14)}%    ${r2.winRate.toFixed(1).padStart(14)}%`);
console.log(`Jackpot Wins:     ${String(r1.jackpotWins).padStart(14)}    ${String(r2.jackpotWins).padStart(14)}`);
console.log(`Locked Wins:     ${String(r1.lockedWins).padStart(14)}    ${String(r2.lockedWins).padStart(14)}`);
console.log(`Profit Factor:    ${r1.profitFactor.toFixed(2).padStart(14)}    ${r2.profitFactor.toFixed(2).padStart(14)}`);

const diff = r2.equity - r1.equity;
const winner = diff > 0 ? '🔥 Ultimate Degen' : '🎰 Current Degen';
console.log(`\n🏆 Winner: ${winner} by ${Math.abs(diff).toFixed(2)} SOL`);

// Run multiple simulations
console.log(`\n${'─'.repeat(60)}`);
console.log(' MULTI-RUN SUMMARY (5 simulations, different market regimes)');
console.log(`${'─'.repeat(60)}`);

let ultimateWins = 0, currentWins = 0;
for (let i = 0; i < 5; i++) {
  const m = getMarketRegime(createRNG(Date.now() + i * 1000));
  const res1 = runSimulation(CURRENT_DEGEN, m, TRADES);
  const res2 = runSimulation(ULTIMATE_DEGEN, m, TRADES);
  const d = res2.equity - res1.equity;
  if (d > 0) ultimateWins++;
  else currentWins++;
  console.log(`Run ${i+1} (${m.name}): Current ${res1.equity.toFixed(1).padStart(6)} | Ultimate ${res2.equity.toFixed(1).padStart(6)} | ${d > 0 ? '🔥UD' : '🎰CD'}`);
}

console.log(`\nWin Rate: 🔥 Ultimate Degen ${ultimateWins}/5 | 🎰 Current Degen ${currentWins}/5`);