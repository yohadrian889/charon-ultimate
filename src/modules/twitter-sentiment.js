/**
 * TWITTER SENTIMENT MODULE
 * 
 * Monitors X (Twitter) for token-related social signals.
 * Tracks: tweet volume, sentiment, viral posts, influencer activity.
 * 
 * Free tier APIs used:
 * - Twitter API v2 (500k tweets/month free)
 * - Alternative: nitter instances for read-only access
 */

import axios from 'axios';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || '';

// In-memory cache for rate limiting
const sentimentCache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute cache

/**
 * Search recent tweets containing a keyword/token symbol
 */
export async function searchRecentTweets(query, maxResults = 10) {
  if (!TWITTER_BEARER_TOKEN) {
    console.log('[twitter] No TWITTER_BEARER_TOKEN configured — skipping search');
    return null;
  }
  
  const cacheKey = `search:${query}:${maxResults}`;
  if (sentimentCache.has(cacheKey)) {
    const cached = sentimentCache.get(cacheKey);
    if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;
  }
  
  try {
    const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
      params: {
        query: `$${query} (crypto OR solana OR pumpfun OR memecoin)`,
        max_results: Math.min(maxResults, 100),
        'tweet.fields': 'created_at,public_metrics,author_id,entities',
        'user.fields': 'public_metrics,followers_count',
      },
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
    
    const data = {
      tweets: response.data?.data || [],
      meta: response.data?.meta || {},
      fetchedAt: Date.now(),
    };
    
    sentimentCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (error) {
    console.log(`[twitter] Search error for ${query}: ${error.message}`);
    return null;
  }
}

/**
 * Analyze sentiment for a token based on recent tweets
 */
export async function getTokenSentiment(symbol, mint) {
  const [tweetsResult, mentionsResult] = await Promise.all([
    searchRecentTweets(symbol, 20),
    searchRecentTweets(mint.slice(0, 8), 10),
  ]);
  
  if (!tweetsResult?.tweets?.length) {
    return {
      score: 0,
      tweetCount: 0,
      avgEngagement: 0,
      influencerCount: 0,
      bullishSignals: [],
      bearishSignals: [],
      summary: 'No Twitter data available',
    };
  }
  
  const tweets = tweetsResult.tweets;
  
  // Calculate engagement metrics
  const engagements = tweets.map(t => 
    (t.public_metrics?.retweet_count || 0) + 
    (t.public_metrics?.like_count || 0) + 
    (t.public_metrics?.reply_count || 0) * 2
  );
  const avgEngagement = engagements.reduce((a, b) => a + b, 0) / engagements.length;
  
  // Identify high-engagement (influencer) tweets
  const influencerTweets = tweets.filter(t => 
    (t.public_metrics?.retweet_count || 0) > 50 ||
    (t.public_metrics?.like_count || 0) > 100
  );
  
  // Simple keyword-based sentiment
  const bullishKeywords = ['moon', 'pump', 'bullish', 'long', 'buy', 'call', 'to the moon', 'wagmi', 'bull run', '+', '🚀', '💎'];
  const bearishKeywords = ['dump', 'bearish', 'short', 'sell', 'scam', 'rug', 'red', '-', 'crash', 'liquidation'];
  
  let bullishCount = 0;
  let bearishCount = 0;
  
  for (const tweet of tweets) {
    const text = (tweet.text || '').toLowerCase();
    for (const kw of bullishKeywords) {
      if (text.includes(kw)) { bullishCount++; break; }
    }
    for (const kw of bearishKeywords) {
      if (text.includes(kw)) { bearishCount++; break; }
    }
  }
  
  // Calculate sentiment score (-100 to +100)
  const totalSignals = bullishCount + bearishCount;
  const sentimentScore = totalSignals > 0 
    ? Math.round(((bullishCount - bearishCount) / totalSignals) * 100)
    : 0;
  
  // Sentiment labels
  const bullishSignals = [];
  const bearishSignals = [];
  
  if (sentimentScore > 30) bullishSignals.push('Overall bullish sentiment');
  if (sentimentScore < -30) bearishSignals.push('Overall bearish sentiment');
  if (influencerTweets.length > 3) bullishSignals.push(`${influencerTweets.length} high-engagement posts`);
  if (tweets.length > 10) bullishSignals.push(`${tweets.length} recent mentions (high volume)`);
  if (avgEngagement > 500) bullishSignals.push(`High average engagement (${Math.round(avgEngagement)})`);
  if (bearishCount > bullishCount) bearishSignals.push('Sell/dump signals detected');
  
  return {
    score: sentimentScore,
    tweetCount: tweets.length,
    avgEngagement: Math.round(avgEngagement),
    influencerCount: influencerTweets.length,
    bullishSignals,
    bearishSignals,
    summary: sentimentScore > 30 
      ? `Bullish (${sentimentScore > 60 ? 'Very Strong' : 'Moderate'})`
      : sentimentScore < -30 
        ? `Bearish (${sentimentScore < -60 ? 'Very Strong' : 'Moderate'})`
        : 'Neutral',
  };
}

/**
 * Monitor for viral tweets about a token (for alerts)
 */
export async function checkViralMentions(symbol, threshold = 1000) {
  const result = await searchRecentTweets(symbol, 50);
  if (!result?.tweets?.length) return { viral: false, tweets: [] };
  
  const viralTweets = result.tweets.filter(t => 
    (t.public_metrics?.retweet_count || 0) > threshold ||
    (t.public_metrics?.like_count || 0) > threshold * 2
  );
  
  return {
    viral: viralTweets.length > 0,
    count: viralTweets.length,
    tweets: viralTweets.slice(0, 5).map(t => ({
      id: t.id,
      engagements: t.public_metrics,
      createdAt: t.created_at,
    })),
  };
}