# Charon Ultimate 🚀

**Enhanced trading bot for Pump.fun and Solana memecoins.**

Based on [Charon](https://github.com/yunus-0x/charon) by yunus-0x, with added features:

- 💰 **Profit Lock System** — Dynamic exit strategy that locks profits as price rises
- 🐦 **Twitter/X Sentiment** — Real-time social sentiment analysis
- 🦈 **Smart Wallet Tracking** — Follow profitable traders' wallets
- 💎 **Trading Presets** — Pre-configured strategies (Stable Money, Degen, Smart Money, Holder)

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/yohadrian889/charon-ultimate.git
cd charon-ultimate

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env with your API keys
nano .env

# 5. Run deployment script
chmod +x deploy.sh
./deploy.sh
```

---

## Features

### Profit Lock System
Dynamic exit strategy that locks profits progressively:

| Price Action | Lock Level |
|-------------|------------|
| +15% | +5% |
| +40% | +20% |
| +80% | +50% |
| +80%+ | High - 30% (dynamic) |

No fixed TP — lets winners run while protecting against reversals.

### Trading Presets

| Preset | Description | Risk |
|--------|-------------|------|
| 💰 Stable Money | Conservative, lock profits early | Low |
| 🎰 Degen | High risk, let winners run | High |
| 🦈 Smart Money | Follow expert traders | Medium |
| 💎 Diamond Hands | Long-term hold | Medium |

---

## Required API Keys

1. **Telegram Bot Token** — Get from [@BotFather](https://t.me/BotFather)
2. **Helius API Key** — Free at [helius.xyz](https://helius.xyz)
3. **GMGN API Key** — Free at [gmgn.ai](https://gmgn.ai)
4. **Signal Server Key** — Contact [Charon maintainer](https://github.com/yunus-0x/charon)
5. **Twitter Bearer Token** (optional) — Free at [developer.twitter.com](https://developer.twitter.com)

---

## Deploy on VPS (Ubuntu)

```bash
git clone https://github.com/yohadrian889/charon-ultimate.git
cd charon-ultimate
chmod +x deploy.sh
./deploy.sh
```

---

## Telegram Commands

- `/menu` — Open strategy menu
- `/preset [name]` — Switch preset (stable_money, degen, smart_money, holder)
- `/positions` — View open positions
- `/pnl` — Show profit/loss
- `/alerts` — Recent buy alerts from tracked wallets

---

## Version History

- **v2.0.0** — Added profit lock, sentiment, wallet tracking, presets

---

## Disclaimer

This software is for educational purposes only. Crypto trading involves substantial risk of loss. Use at your own risk.

---

**Built for Yoh** 🤖