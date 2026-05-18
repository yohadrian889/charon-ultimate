/**
 * TRADING PRESETS
 * 
 * Pre-configured strategy profiles for different trading styles.
 * Each preset has different risk/reward profiles.
 * 
 * Presets:
 * - stable_money: Conservative, prioritizes not losing over big gains
 * - degen: Aggressive, high risk high reward
 * - smart_money: Balanced, follows smart money patterns
 * - holder: Long-term, ignores short-term volatility
 */

export const PRESETS = {
  /**
   * STABLE MONEY PRESET
   * Conservative approach. Lock profits early, small losses, consistent returns.
   */
  stable_money: {
    id: 'stable_money',
    name: '💰 Stable Money',
    description: 'Conservative approach. Lock profits early, small losses, consistent returns.',
    
    position_size_sol: 0.05,
    max_open_positions: 3,
    
    min_mcap_usd: 10000,
    max_mcap_usd: 150000,
    min_holders: 100,
    min_liquidity_usd: 5000,
    
    min_fee_claim_sol: 0.3,
    token_age_min_ms: 30 * 60 * 1000,
    token_age_max_ms: 3 * 60 * 60 * 1000,
    
    tp_percent: 999,
    use_profit_lock: true,
    
    sl_percent: -25,
    trailing_enabled: true,
    trailing_percent: 25,
    
    profit_lock_tiers: [
      { threshold: 0.10, lock: 0.03 },
      { threshold: 0.25, lock: 0.10 },
      { threshold: 0.50, lock: 0.25 },
      { threshold: 0.80, lock: 0.40 },
    ],
    profit_lock_dynamic_pct: 0.35,
    
    max_hold_ms: 30 * 60 * 1000,
    
    partial_tp: true,
    partial_tp_at_percent: 20,
    partial_tp_sell_percent: 50,
    
    daily_loss_limit_pct: 10,
    max_daily_trades: 10,
    
    use_llm: true,
    llm_min_confidence: 60,
  },
  
  /**
   * DEGEN PRESET
   * High risk, high reward. Let winners run, cut losers fast.
   */
  degen: {
    id: 'degen',
    name: '🎰 Degen',
    description: 'High risk, high reward. Let winners run, cut losers fast.',
    
    position_size_sol: 0.2,
    max_open_positions: 5,
    
    min_mcap_usd: 5000,
    max_mcap_usd: 300000,
    min_holders: 50,
    min_liquidity_usd: 2000,
    
    min_fee_claim_sol: 0.1,
    token_age_min_ms: 5 * 60 * 1000,
    token_age_max_ms: 60 * 60 * 1000,
    
    tp_percent: 999,
    use_profit_lock: false,
    
    sl_percent: -40,
    trailing_enabled: false,
    
    profit_lock_tiers: [
      { threshold: 1.00, lock: 0.50 },
      { threshold: 2.00, lock: 1.00 },
    ],
    profit_lock_dynamic_pct: 0.40,
    
    max_hold_ms: 0,
    
    partial_tp: false,
    
    daily_loss_limit_pct: 15,
    max_daily_trades: 20,
    
    use_llm: true,
    llm_min_confidence: 40,
  },
  
  /**
   * SMART MONEY PRESET
   * Follow smart money. Copy expert traders for lower risk.
   */
  smart_money: {
    id: 'smart_money',
    name: '🦈 Smart Money',
    description: 'Follow smart money. Copy expert traders for lower risk.',
    
    position_size_sol: 0.1,
    max_open_positions: 4,
    
    min_mcap_usd: 15000,
    max_mcap_usd: 200000,
    min_holders: 150,
    min_liquidity_usd: 10000,
    
    min_fee_claim_sol: 0.5,
    token_age_min_ms: 60 * 60 * 1000,
    token_age_max_ms: 4 * 60 * 60 * 1000,
    
    tp_percent: 999,
    use_profit_lock: true,
    
    sl_percent: -20,
    trailing_enabled: true,
    trailing_percent: 15,
    
    profit_lock_tiers: [
      { threshold: 0.20, lock: 0.10 },
      { threshold: 0.50, lock: 0.25 },
      { threshold: 1.00, lock: 0.50 },
    ],
    profit_lock_dynamic_pct: 0.30,
    
    max_hold_ms: 2 * 60 * 60 * 1000,
    
    partial_tp: true,
    partial_tp_at_percent: 30,
    partial_tp_sell_percent: 40,
    
    daily_loss_limit_pct: 8,
    max_daily_trades: 12,
    
    require_smart_money: true,
    min_smart_money_ratio: 0.20,
    
    use_llm: true,
    llm_min_confidence: 70,
  },
  
  /**
   * HOLDER PRESET
   * Long-term hold. Ignore short-term swings, take profits at major levels.
   */
  holder: {
    id: 'holder',
    name: '💎 Diamond Hands',
    description: 'Long-term hold. Ignore short-term swings, take profits at major levels.',
    
    position_size_sol: 0.15,
    max_open_positions: 3,
    
    min_mcap_usd: 50000,
    max_mcap_usd: 1000000,
    min_holders: 500,
    min_liquidity_usd: 25000,
    
    min_fee_claim_sol: 1.0,
    token_age_min_ms: 2 * 60 * 60 * 1000,
    token_age_max_ms: 0,
    
    tp_percent: 999,
    use_profit_lock: true,
    
    sl_percent: -50,
    trailing_enabled: true,
    trailing_percent: 40,
    
    profit_lock_tiers: [
      { threshold: 0.30, lock: 0.15 },
      { threshold: 1.00, lock: 0.50 },
      { threshold: 3.00, lock: 1.50 },
    ],
    profit_lock_dynamic_pct: 0.35,
    
    max_hold_ms: 0,
    
    partial_tp: true,
    partial_tp_at_percent: 100,
    partial_tp_sell_percent: 25,
    
    daily_loss_limit_pct: 20,
    max_daily_trades: 3,
    
    use_llm: true,
    llm_min_confidence: 80,
  },
};

export const DEFAULT_PRESET = 'stable_money';

export function getPreset(id) {
  return PRESETS[id] || PRESETS[DEFAULT_PRESET];
}

export function applyPreset(presetId, baseConfig = {}) {
  const preset = getPreset(presetId);
  return {
    ...baseConfig,
    ...preset,
    id: preset.id,
    name: preset.name,
  };
}