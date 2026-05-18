/**
 * SMART WALLET TRACKER
 * 
 * Tracks whale/profitable wallets and alerts when they make moves.
 * Features:
 * - Track top traders by PnL
 * - Alert when tracked wallets buy/sell
 * - Discover profitable wallets through on-chain analysis
 * 
 * Uses Helius API for on-chain data (free tier available)
 */

import axios from 'axios';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

// Cache for wallet data
const walletCache = new Map();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Get wallet's transaction history from Helius
 */
export async function getWalletTransactions(address, limit = 20) {
  const cacheKey = `tx:${address}:${limit}`;
  if (walletCache.has(cacheKey)) {
    const cached = walletCache.get(cacheKey);
    if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  }
  
  try {
    const response = await axios.post(`https://api.helius.xyz/v0/addresses/${address}/transactions`, {
      apiKey: HELIUS_API_KEY,
      limit,
      type: ['TRANSFER', 'SWAP', 'JUPITER_SWAP'],
    }, {
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
    
    const data = response.data?.transactions || [];
    walletCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (error) {
    console.log(`[wallet] Failed to fetch transactions for ${address}: ${error.message}`);
    return [];
  }
}

/**
 * Analyze a wallet's trading performance
 */
export async function analyzeWalletPerformance(address) {
  const transactions = await getWalletTransactions(address, 50);
  if (!transactions.length) return null;
  
  const swaps = transactions.filter(tx => 
    tx.type === 'SWAP' || tx.type === 'JUPITER_SWAP' || tx.instructions?.some(i => i?.program === 'jupiter')
  );
  
  // Calculate buy/sell patterns
  let buyCount = 0;
  let sellCount = 0;
  let totalBuys = 0;
  let totalSells = 0;
  
  for (const swap of swaps) {
    const fee = Number(swap.fee || 0) / 1_000_000_000; // lamports to SOL
    if (swap.quote?.outputMint === 'So11111111111111111111111111111111111111112') {
      sellCount++;
      totalSells += fee;
    } else if (swap.quote?.inputMint === 'So11111111111111111111111111111111111111112') {
      buyCount++;
      totalBuys += fee;
    }
  }
  
  return {
    address,
    totalSwaps: swaps.length,
    buyCount,
    sellCount,
    buyVolumeSol: totalBuys,
    sellVolumeSol: totalSells,
    netFlow: totalBuys - totalSells,
    activityLevel: swaps.length > 10 ? 'high' : swaps.length > 3 ? 'medium' : 'low',
    isActive: swaps.length >= 5,
  };
}

/**
 * Get top traders from GMGN (public endpoint)
 */
export async function getTopTraders(limit = 20) {
  try {
    const response = await axios.get('https://gmgn.ai/api/v1/top_traders/sol', {
      params: { limit },
      timeout: 10_000,
    });
    
    return response.data?.data?.traders || [];
  } catch (error) {
    console.log(`[wallet] Failed to fetch top traders: ${error.message}`);
    return [];
  }
}

/**
 * Check if a tracked wallet made a new buy (for alerts)
 */
export async function checkWalletNewBuys(walletAddress, lastKnownTx = null) {
  const transactions = await getWalletTransactions(walletAddress, 10);
  if (!transactions.length) return { hasNew: false, newTokens: [] };
  
  const newTx = transactions[0];
  if (lastKnownTx && newTx.signature === lastKnownTx) {
    return { hasNew: false, newTokens: [] };
  }
  
  const buyTxs = transactions.filter(tx => {
    const hasSolInput = tx.quote?.inputMint === 'So11111111111111111111111111111111111111112';
    return hasSolInput && tx.signature !== lastKnownTx;
  });
  
  const newTokens = buyTxs.map(tx => ({
    mint: tx.quote?.outputMint,
    symbol: tx.quote?.outputSymbol || 'Unknown',
    amount: tx.quote?.inputAmount,
    txSig: tx.signature,
    timestamp: tx.timestamp,
  }));
  
  return {
    hasNew: newTokens.length > 0,
    newTokens,
    latestTx: newTx.signature,
  };
}

/**
 * Track multiple wallets and their positions
 */
export class WalletTracker {
  constructor() {
    this.trackedWallets = new Map();
    this.buyAlerts = [];
  }
  
  addWallet(address, label = '') {
    this.trackedWallets.set(address.toLowerCase(), {
      lastTx: null,
      addedAt: Date.now(),
      label,
    });
    console.log(`[wallet] Now tracking ${address}${label ? ` (${label})` : ''}`);
  }
  
  removeWallet(address) {
    this.trackedWallets.delete(address.toLowerCase());
  }
  
  async checkAllWallets() {
    const alerts = [];
    
    for (const [address, data] of this.trackedWallets) {
      const result = await checkWalletNewBuys(address, data.lastTx);
      
      if (result.hasNew) {
        this.trackedWallets.set(address, {
          ...data,
          lastTx: result.latestTx,
        });
        
        for (const token of result.newTokens) {
          alerts.push({
            wallet: address,
            label: data.label,
            token: token.mint,
            symbol: token.symbol,
            amount: token.amount,
            tx: token.txSig,
            time: token.timestamp,
          });
          
          this.buyAlerts.push({
            wallet: address,
            token: token.mint,
            symbol: token.symbol,
            amount: token.amount,
            timestamp: Date.now(),
          });
        }
      }
    }
    
    if (this.buyAlerts.length > 100) {
      this.buyAlerts = this.buyAlerts.slice(-100);
    }
    
    return alerts;
  }
  
  getRecentAlerts(count = 10) {
    return this.buyAlerts.slice(-count).reverse();
  }
  
  getStats() {
    return {
      trackedCount: this.trackedWallets.size,
      recentAlerts: this.buyAlerts.length,
      wallets: Array.from(this.trackedWallets.entries()).map(([addr, data]) => ({
        address: addr,
        label: data.label,
        addedAt: new Date(data.addedAt).toISOString(),
      })),
    };
  }
}

// Singleton instance
export const walletTracker = new WalletTracker();

/**
 * Discover profitable wallets — searches for wallets with recent good trades
 */
export async function discoverProfitableWallets(minTrades = 5) {
  const topTraders = await getTopTraders(50);
  
  const analyzed = [];
  for (const trader of topTraders.slice(0, 20)) {
    const addr = trader.address || trader.wallet;
    if (!addr) continue;
    
    const perf = await analyzeWalletPerformance(addr);
    if (perf && perf.totalSwaps >= minTrades) {
      analyzed.push({
        ...perf,
        label: trader.label || trader.name || '',
      });
    }
  }
  
  return analyzed
    .filter(w => w.isActive)
    .sort((a, b) => b.netFlow - a.netFlow)
    .slice(0, 20);
}