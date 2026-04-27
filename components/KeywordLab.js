'use client';

import React, { useState } from 'react';
import {
  Search, Loader2, AlertCircle, TrendingUp, HelpCircle, Sparkles,
  Download, ChevronDown, ChevronUp, Target, Building2, Zap,
  Filter, BarChart3, Layers, FileText, Award, Bot, Swords, ExternalLink, ArrowRight,
} from 'lucide-react';

// ===== Helpers =====
const STOP_WORDS = new Set(['the','and','for','with','are','you','how','what','why','can','does','when','where','who','will','should','this','that','have','has','from','your','our','their','about','into','just','only','such','than','too']);

function tokenize(s) {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t)));
}
function jaccardSimilarity(a, b) {
  const setA = a instanceof Set ? a : tokenize(a);
  const setB = b instanceof Set ? b : tokenize(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
function clusterKeywords(keywords, threshold = 0.4) {
  const tokenized = keywords.map(k => ({ ...k, tokens: tokenize(k.keyword) }));
  tokenized.sort((a, b) => b.volume - a.volume);
  const clusters = [];
  for (const kw of tokenized) {
    let bestCluster = null; let bestSim = threshold;
    for (const cluster of clusters) {
      const sim = jaccardSimilarity(kw.tokens, cluster.tokens);
      if (sim > bestSim) { bestSim = sim; bestCluster = cluster; }
    }
    if (bestCluster) { bestCluster.keywords.push(kw); bestCluster.totalVolume += kw.volume; }
    else { clusters.push({ name: kw.keyword, tokens: kw.tokens, keywords: [kw], totalVolume: kw.volume }); }
  }
  clusters.sort((a, b) => b.totalVolume - a.totalVolume);
  return clusters;
}
function computeMqlScore(kw) {
  let score = 0;
  const intentWeights = { transactional: 40, commercial: 30, navigational: 15, informational: 8, unknown: 5 };
  score += intentWeights[kw.intent] || 5;
  if (kw.isEmbeeRelevant) score += 20;
  if (/\b(enterprise|business|company|corporate|implementation|consulting|services|solutions|provider|partner|professional|b2b)\b/i.test(kw.keyword)) score += 15;
  if (kw.isLocation) score += 10;
  if (kw.difficulty !== null) {
    if (kw.difficulty < 30) score += 15;
    else if (kw.difficulty < 50) score += 10;
    else if (kw.difficulty < 70) score += 5;
  } else { score += 5; }
  if (kw.volume < 10) score = Math.max(0, score - 20);
  if (kw.volume >= 100 && kw.volume < 1000) score += 5;
  return Math.min(100, Math.max(0, score));
}
function recommendPageType(kw) {
  const k = kw.keyword.toLowerCase();
  if (/\b(price|pricing|cost|how much|fees|charges)\b/.test(k)) return { type: 'Pricing Page', code: 'pricing' };
  if (/\b(vs|versus|compare|comparison|alternative|alternatives)\b/.test(k)) return { type: 'Comparison Page', code: 'comparison' };
  if (/\b(best|top \d+|top-rated|leading)\b/.test(k)) return { type: 'Listicle / Overview', code: 'listicle' };
  if (/^(what|how|why|when|where|who|can|does|is|are|should|will|do)\s/.test(k)) return { type: 'Blog Post / FAQ', code: 'blog' };
  if (kw.isLocation && kw.isEmbeeRelevant) return { type: 'Service Landing Page', code: 'landing' };
  if (/\b(implementation|consulting|migration|deployment|setup|integration)\b/.test(k)) return { type: 'Solution Detail Page', code: 'solution' };
  if (kw.intent === 'commercial' || kw.intent === 'transactional') return { type: 'Solution Page', code: 'solution' };
  return { type: 'Blog Post', code: 'blog' };
}
function getSerpFeatures(item) {
  const types = item.serp_info?.serp_item_types || [];
  return {
    hasAiOverview: types.includes('ai_overview'),
    hasFeaturedSnippet: types.includes('featured_snippet'),
    hasPaa: types.includes('people_also_ask'),
    hasShopping: types.includes('shopping') || types.includes('google_shopping'),
    hasVideo: types.includes('video'),
    hasLocalPack: types.includes('local_pack'),
  };
}
function detectFlags(kw) {
  return {
    isQuestion: /^(what|how|why|when|where|who|can|does|is|are|should|will|do)\s/i.test(kw),
    isComparison: /\b(vs|versus|compare|comparison|alternative|alternatives|best|top|review|reviews)\b/i.test(kw),
    isLocation: /\b(india|mumbai|bangalore|delhi|pune|hyderabad|chennai|gurgaon|noida|kolkata)\b/i.test(kw),
    isEmbeeRelevant: /\b(azure|microsoft|365|copilot|sap|s4hana|hana|hrms|cloud|cyber|security|managed|it services|data center|fabric|teams|xdr|iam|identity)\b/i.test(kw),
  };
}

export default function KeywordLab() {
  // Keyword research state
  const [seedKeyword, setSeedKeyword] = useState('');
  const [serviceLine, setServiceLine] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('clusters');
  const [sortBy, setSortBy] = useState('mqlScore');
  const [sortDir, setSortDir] = useState('desc');
  const [kdFilter, setKdFilter] = useState('all');
  const [volumeFilter, setVolumeFilter] = useState('all');
  const [expandedCluster, setExpandedCluster] = useState(null);

  // Mode toggle: 'keyword' or 'competitor'
  const [mode, setMode] = useState('keyword');
  
  // Competitor analysis state
  const [selectedCompetitor, setSelectedCompetitor] = useState('hcltech.com');
  const [customCompetitor, setCustomCompetitor] = useState('');
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState('');
  const [compResults, setCompResults] = useState(null);
  const [compTab, setCompTab] = useState('gap');
  const [compSortBy, setCompSortBy] = useState('volume');
  const [compSortDir, setCompSortDir] = useState('desc');

  const serviceLines = [
    { id: 'all', name: 'All Services', seeds: [] },
    { id: 'cloud', name: 'Cloud Modernization', seeds: ['cloud migration services', 'azure partners india', 'cloud consulting services'] },
    { id: 'dataai', name: 'Data & AI / Copilot', seeds: ['microsoft copilot', 'microsoft fabric', 'ai productivity tools'] },
    { id: 'cyber', name: 'Cybersecurity', seeds: ['managed xdr', 'identity and access management', 'cyber security services india'] },
    { id: 'workplace', name: 'Modern Workplace', seeds: ['microsoft 365 business plans', 'microsoft teams for business', 'hybrid work solutions'] },
    { id: 'managed', name: 'Managed Services', seeds: ['managed it services', 'managed service providers in india', 'it managed services'] },
    { id: 'apps', name: 'Business Apps (SAP & HRMS)', seeds: ['sap business one', 's4hana implementation', 'hrms software india'] },
  ];

  const competitors = ['sonata-software.com', 'softwareone.com', 'g7cr.in', 'noventiqindia.com', 'hcltech.com'];
  const suggestionsByService = serviceLines.find(s => s.id === serviceLine)?.seeds || [];

  const fetchKeywordData = async () => {
    if (!seedKeyword.trim()) { setError('Please enter a seed keyword'); return; }
    setLoading(true); setError(''); setResults(null);
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: seedKeyword, locationCode: 2356 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
      const items = data.items || [];

      const allKeywords = items.map(item => {
        const kw = item.keyword;
        const flags = detectFlags(kw);
        const intent = item.search_intent_info?.main_intent || 'unknown';
        const serpFeatures = getSerpFeatures(item);
        const baseKw = {
          keyword: kw,
          volume: item.keyword_info?.search_volume || 0,
          cpc: item.keyword_info?.cpc || 0,
          competition: item.keyword_info?.competition_level || 'UNKNOWN',
          difficulty: item.keyword_properties?.keyword_difficulty || null,
          intent, ...flags, ...serpFeatures,
        };
        return { ...baseKw, mqlScore: computeMqlScore(baseKw), pageType: recommendPageType(baseKw) };
      });

      const seoKeywords = allKeywords.filter(k => k.volume > 0);
      const aeoKeywords = allKeywords.filter(k => k.isQuestion);
      const geoKeywords = allKeywords.filter(k => k.isComparison || /^(how to|how do|how does|why should)/i.test(k.keyword) || /\balternative|review|pricing|cost\b/i.test(k.keyword) || k.hasAiOverview);
      const quickWins = allKeywords.filter(k => k.difficulty !== null && k.difficulty < 30 && k.volume >= 50 && k.isEmbeeRelevant).sort((a,b) => b.mqlScore - a.mqlScore);
      const topMqls = [...allKeywords].sort((a,b) => b.mqlScore - a.mqlScore).slice(0, 50);

      const clusters = clusterKeywords(seoKeywords, 0.4);
      clusters.forEach(c => {
        const validKds = c.keywords.filter(k => k.difficulty !== null);
        c.avgDifficulty = validKds.length > 0 ? Math.round(validKds.reduce((s,k) => s + k.difficulty, 0) / validKds.length) : null;
        c.avgMqlScore = Math.round(c.keywords.reduce((s,k) => s + k.mqlScore, 0) / c.keywords.length);
        const typeCounts = {};
        c.keywords.forEach(k => { typeCounts[k.pageType.type] = (typeCounts[k.pageType.type] || 0) + 1; });
        c.dominantPageType = Object.entries(typeCounts).sort((a,b) => b[1] - a[1])[0][0];
      });

      setResults({ seo: seoKeywords, aeo: aeoKeywords, geo: geoKeywords, quickWins, topMqls, clusters, seed: seedKeyword });
    } catch (err) {
      setError(err.message || 'Failed to fetch keyword data');
    } finally { setLoading(false); }
  };

  const fetchCompetitorData = async () => {
    const domain = customCompetitor.trim() || selectedCompetitor;
    if (!domain) { setCompError('Please select or enter a competitor domain'); return; }
    setCompLoading(true); setCompError(''); setCompResults(null);
    try {
      const res = await fetch('/api/competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorDomain: domain, locationCode: 2356, mode: 'gap' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);

      // Enrich with MQL score + page type
      const enrichGap = data.gap.map(k => {
        const flags = detectFlags(k.keyword);
        const enriched = { ...k, ...flags };
        return { ...enriched, mqlScore: computeMqlScore(enriched), pageType: recommendPageType(enriched) };
      });
      const enrichOverlap = data.overlap.map(k => {
        const flags = detectFlags(k.keyword);
        const enriched = { ...k, ...flags };
        return { ...enriched, mqlScore: computeMqlScore(enriched), pageType: recommendPageType(enriched) };
      });

      setCompResults({ gap: enrichGap, overlap: enrichOverlap, stats: data.stats });
    } catch (err) {
      setCompError(err.message || 'Failed to fetch competitor data');
    } finally { setCompLoading(false); }
  };

  const applyFilters = (data) => {
    return data.filter(k => {
      if (kdFilter === 'easy' && (k.difficulty === null || k.difficulty >= 30)) return false;
      if (kdFilter === 'medium' && (k.difficulty === null || k.difficulty < 30 || k.difficulty >= 60)) return false;
      if (kdFilter === 'hard' && (k.difficulty === null || k.difficulty < 60)) return false;
      if (volumeFilter === 'high' && k.volume < 1000) return false;
      if (volumeFilter === 'medium' && (k.volume < 100 || k.volume >= 1000)) return false;
      if (volumeFilter === 'low' && k.volume >= 100) return false;
      return true;
    });
  };

  const sortedData = () => {
    if (!results) return [];
    const data = activeTab === 'quickwins' ? results.quickWins : activeTab === 'topmqls' ? results.topMqls : results[activeTab] || [];
    const filtered = applyFilters(data);
    filtered.sort((a, b) => {
      let aVal = a[sortBy]; let bVal = b[sortBy];
      if (aVal === null) aVal = -1; if (bVal === null) bVal = -1;
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return filtered;
  };

  const sortedCompData = () => {
    if (!compResults) return [];
    const data = compTab === 'gap' ? compResults.gap : compResults.overlap;
    const sorted = [...data];
    sorted.sort((a, b) => {
      let aVal = a[compSortBy]; let bVal = b[compSortBy];
      if (aVal === null) aVal = -1; if (bVal === null) bVal = -1;
      if (typeof aVal === 'string') return compSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return compSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };
  const toggleCompSort = (field) => {
    if (compSortBy === field) setCompSortDir(compSortDir === 'asc' ? 'desc' : 'asc');
    else { setCompSortBy(field); setCompSortDir('desc'); }
  };

  const exportCSV = () => {
    if (!results) return;
    let csv;
    if (activeTab === 'clusters') {
      const headers = ['Cluster Name', 'Keywords', 'Total Volume', 'Avg KD', 'Avg MQL', 'Page Type', 'All Keywords'];
      const rows = results.clusters.map(c => [`"${c.name}"`, c.keywords.length, c.totalVolume, c.avgDifficulty ?? 'N/A', c.avgMqlScore, `"${c.dominantPageType}"`, `"${c.keywords.map(k => k.keyword).join(' | ')}"`].join(','));
      csv = [headers.join(','), ...rows].join('\n');
    } else {
      const data = sortedData();
      const headers = ['Keyword', 'Volume', 'CPC (INR)', 'KD', 'MQL Score', 'Intent', 'Page Type', 'AI Overview', 'Featured Snippet'];
      const rows = data.map(k => [`"${k.keyword}"`, k.volume, (k.cpc * 83).toFixed(0), k.difficulty ?? 'N/A', k.mqlScore, k.intent, `"${k.pageType.type}"`, k.hasAiOverview ? 'Yes' : 'No', k.hasFeaturedSnippet ? 'Yes' : 'No'].join(','));
      csv = [headers.join(','), ...rows].join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `embee-${results.seed.replace(/\s+/g, '-')}-${activeTab}.csv`; a.click();
  };

  const exportCompCSV = () => {
    if (!compResults) return;
    const data = sortedCompData();
    const headers = ['Keyword', 'Volume', 'CPC (INR)', 'KD', 'MQL Score', 'Intent', 'Competitor Rank', 'Embee Rank', 'Page Type', 'Competitor URL'];
    const rows = data.map(k => [`"${k.keyword}"`, k.volume, (k.cpc * 83).toFixed(0), k.difficulty ?? 'N/A', k.mqlScore, k.intent, k.competitorRank, k.embeeRank ?? 'N/A', `"${k.pageType.type}"`, `"${k.competitorUrl}"`].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `embee-vs-${compResults.stats.competitor.replace(/\./g, '-')}-${compTab}.csv`; a.click();
  };

  const getKdBadge = (score) => {
    if (score === null || score === undefined) return { label: '���', color: 'bg-slate-100 text-slate-500 border-slate-200' };
    if (score < 30) return { label: score, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (score < 60) return { label: score, color: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { label: score, color: 'bg-red-100 text-red-800 border-red-300' };
  };
  const getMqlBadge = (score) => {
    if (score >= 70) return 'bg-pink-100 text-pink-800 border-pink-300';
    if (score >= 50) return 'bg-violet-100 text-violet-800 border-violet-300';
    if (score >= 30) return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };
  const getRankBadge = (rank) => {
    if (rank === null || rank === undefined) return 'bg-slate-100 text-slate-400 border-slate-200';
    if (rank <= 3) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (rank <= 10) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (rank <= 20) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };
  const getIntentBadge = (intent) => ({
    informational: 'bg-blue-50 text-blue-700 border-blue-200',
    commercial: 'bg-amber-50 text-amber-700 border-amber-200',
    transactional: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    navigational: 'bg-violet-50 text-violet-700 border-violet-200',
    unknown: 'bg-slate-50 text-slate-600 border-slate-200',
  }[intent] || 'bg-slate-50 text-slate-600 border-slate-200');
  const getPageTypeColor = (code) => ({
    pricing: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    comparison: 'bg-violet-50 text-violet-800 border-violet-200',
    listicle: 'bg-amber-50 text-amber-800 border-amber-200',
    blog: 'bg-blue-50 text-blue-800 border-blue-200',
    landing: 'bg-pink-50 text-pink-800 border-pink-200',
    solution: 'bg-rose-50 text-rose-800 border-rose-200',
  }[code] || 'bg-slate-50 text-slate-700 border-slate-200');

  const tabs = [
    { id: 'clusters', label: 'Clusters', icon: Layers, isNew: false },
    { id: 'topmqls', label: 'Top MQLs', icon: Award },
    { id: 'quickwins', label: 'Quick Wins', icon: Zap },
    { id: 'seo', label: 'All SEO', icon: TrendingUp },
    { id: 'aeo', label: 'AEO', icon: HelpCircle },
    { id: 'geo', label: 'GEO', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-lg bg-white/80">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">E</div>
            <div>
              <div className="font-bold text-slate-900 leading-none flex items-center gap-2">
                Embee Keyword Lab
                <span className="text-[9px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-mono">v3</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">Internal �� India �� Competitor Intel</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 border border-emerald-200 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            API Connected �� DataForSEO
          </div>
        </div>
      </header>

      {/* Mode toggle */}
      <div className="max-w-[1400px] mx-auto px-6 pt-6">
        <div className="inline-flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          <button onClick={() => setMode('keyword')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${mode === 'keyword' ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
            <Search size={14} />Keyword Research
          </button>
          <button onClick={() => setMode('competitor')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all relative ${mode === 'competitor' ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
            <Swords size={14} />Competitor Gap
            {mode !== 'competitor' && (
              <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-bold tracking-wider">NEW</span>
            )}
          </button>
        </div>
      </div>

      {/* KEYWORD MODE */}
      {mode === 'keyword' && (
        <>
          <section className="gradient-mesh">
            <div className="max-w-[1400px] mx-auto px-6 pt-6 pb-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs text-slate-600 mb-5 shadow-sm">
                  <Target size={12} className="text-pink-600" />
                  <span className="font-medium">Targeting:</span>
                  <span className="font-mono">embee.co.in �� India</span>
                  <span className="text-slate-300">��</span>
                  <span className="text-pink-600 font-semibold">Optimized for MQLs</span>
                </div>
                <h1 className="font-serif-d text-5xl md:text-6xl text-slate-900 leading-[1.05] tracking-tight">
                  From keywords to <span className="italic text-pink-600">website blueprint.</span>
                </h1>
                <p className="mt-4 text-slate-600 text-lg max-w-2xl leading-relaxed">
                  Cluster keywords into pages, score for MQL likelihood, and detect SERP features ��� built for the embee.co.in revamp.
                </p>
              </div>

              <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-xl shadow-slate-200/50 max-w-5xl">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 md:col-span-7">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Seed Keyword</label>
                    <div className="relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={seedKeyword} onChange={(e) => setSeedKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchKeywordData()} placeholder="e.g. microsoft 365 business plans" className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 text-slate-900 placeholder:text-slate-400" />
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-3">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Service Line</label>
                    <select value={serviceLine} onChange={(e) => setServiceLine(e.target.value)} className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-pink-500 bg-white text-slate-900">
                      {serviceLines.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-2">
                    <button onClick={fetchKeywordData} disabled={loading} className="w-full bg-gradient-to-br from-pink-500 to-rose-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-pink-500/30 transition-all disabled:from-slate-400 disabled:to-slate-500 flex items-center justify-center gap-2">
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={16} />}
                      {loading ? 'Researching' : 'Research'}
                    </button>
                  </div>
                </div>

                {suggestionsByService.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500 font-medium">Quick start:</span>
                      {suggestionsByService.map(s => (
                        <button key={s} onClick={() => setSeedKeyword(s)} className="text-xs bg-slate-100 hover:bg-pink-50 hover:text-pink-700 text-slate-700 px-3 py-1 rounded-full transition-colors border border-transparent hover:border-pink-200">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-900 fade-in max-w-5xl">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <div className="text-sm">{error}</div>
                </div>
              )}
            </div>
          </section>

          {loading && (
            <section className="max-w-[1400px] mx-auto px-6 py-8">
              <div className="space-y-2">{[1,2,3,4,5,6].map(i => (<div key={i} className="h-14 rounded-lg shimmer"></div>))}</div>
            </section>
          )}

          {results && !loading && (
            <section className="max-w-[1400px] mx-auto px-6 py-8 fade-in">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                {[
                  { label: 'Total Keywords', value: results.seo.length, icon: BarChart3, color: 'text-slate-700' },
                  { label: 'Topic Clusters', value: results.clusters.length, icon: Layers, color: 'text-pink-700' },
                  { label: 'Top MQL Score', value: results.topMqls[0]?.mqlScore || 0, icon: Award, color: 'text-rose-700' },
                  { label: 'Quick Wins', value: results.quickWins.length, icon: Zap, color: 'text-emerald-700' },
                  { label: 'Questions', value: results.aeo.length, icon: HelpCircle, color: 'text-blue-700' },
                  { label: 'Total Volume / mo', value: results.seo.reduce((s,k) => s + k.volume, 0).toLocaleString(), icon: TrendingUp, color: 'text-violet-700' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                      <stat.icon size={12} />{stat.label}
                    </div>
                    <div className={`font-serif-d text-3xl ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="inline-flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm flex-wrap">
                  {tabs.map(tab => {
                    const count = tab.id === 'clusters' ? results.clusters.length : tab.id === 'quickwins' ? results.quickWins.length : tab.id === 'topmqls' ? results.topMqls.length : results[tab.id]?.length || 0;
                    return (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === tab.id ? tab.id === 'clusters' || tab.id === 'topmqls' ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md' : tab.id === 'quickwins' ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md' : 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
                        <tab.icon size={14} />{tab.label}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  {activeTab !== 'clusters' && (
                    <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
                      <Filter size={12} className="text-slate-400 ml-1" />
                      <select value={kdFilter} onChange={(e) => setKdFilter(e.target.value)} className="text-xs bg-transparent border-0 focus:outline-none px-1 py-1 font-medium">
                        <option value="all">All KD</option><option value="easy">Easy (&lt;30)</option><option value="medium">Medium (30-60)</option><option value="hard">Hard (60+)</option>
                      </select>
                      <div className="w-px h-4 bg-slate-200"></div>
                      <select value={volumeFilter} onChange={(e) => setVolumeFilter(e.target.value)} className="text-xs bg-transparent border-0 focus:outline-none px-1 py-1 font-medium">
                        <option value="all">All Volume</option><option value="high">High (1000+)</option><option value="medium">Medium (100-1K)</option><option value="low">Low (&lt;100)</option>
                      </select>
                    </div>
                  )}
                  <button onClick={exportCSV} className="flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                    <Download size={14} />Export
                  </button>
                </div>
              </div>

              <div className={`mb-4 rounded-xl p-4 text-sm ${activeTab === 'clusters' ? 'bg-pink-50 text-pink-900 border border-pink-200' : activeTab === 'topmqls' ? 'bg-rose-50 text-rose-900 border border-rose-200' : activeTab === 'quickwins' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : activeTab === 'seo' ? 'bg-slate-100 text-slate-700 border border-slate-200' : activeTab === 'aeo' ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-violet-50 text-violet-900 border border-violet-200'}`}>
                {activeTab === 'clusters' && (<><strong>���� Topic Clusters ���</strong> Keywords automatically grouped by semantic similarity. Each cluster = ONE page on your new site.</>)}
                {activeTab === 'topmqls' && (<><strong>���� Top MQL Opportunities ���</strong> Top 50 keywords ranked by MQL likelihood score.</>)}
                {activeTab === 'quickwins' && (<><strong>��� Quick Wins ���</strong> Low difficulty + decent volume + Embee-relevant. Rank in 3-6 months.</>)}
                {activeTab === 'seo' && (<><strong>All SEO Keywords ���</strong> Complete list with MQL scores and page type recommendations.</>)}
                {activeTab === 'aeo' && (<><strong>Answer Engine Optimization ���</strong> Question-based queries for featured snippets and PAA.</>)}
                {activeTab === 'geo' && (<><strong>Generative Engine Optimization ���</strong> Comparison + AI Overview-triggering queries.</>)}
              </div>

              {/* CLUSTERS VIEW */}
              {activeTab === 'clusters' && (
                <div className="space-y-3">
                  {results.clusters.map((cluster, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <button onClick={() => setExpandedCluster(expandedCluster === idx ? null : idx)} className="w-full p-4 hover:bg-slate-50 transition-colors text-left flex items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center text-pink-700 font-bold text-sm flex-shrink-0">{String(idx + 1).padStart(2, '0')}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{cluster.name}</div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                              <span className="font-mono">{cluster.keywords.length} keywords</span><span>��</span>
                              <span className="font-mono">{cluster.totalVolume.toLocaleString()} total vol/mo</span><span>��</span>
                              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium border rounded ${getPageTypeColor(cluster.keywords[0].pageType.code)}`}>
                                <FileText size={10} className="mr-1" />{cluster.dominantPageType}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {cluster.avgDifficulty !== null && (
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase">Avg KD</div>
                              <div className={`font-mono font-semibold ${cluster.avgDifficulty < 30 ? 'text-emerald-700' : cluster.avgDifficulty < 60 ? 'text-amber-700' : 'text-red-700'}`}>{cluster.avgDifficulty}</div>
                            </div>
                          )}
                          <div className="text-right">
                            <div className="text-[10px] text-slate-500 uppercase">MQL</div>
                            <div className={`font-mono font-semibold ${cluster.avgMqlScore >= 70 ? 'text-pink-700' : cluster.avgMqlScore >= 50 ? 'text-violet-700' : 'text-slate-600'}`}>{cluster.avgMqlScore}</div>
                          </div>
                          {expandedCluster === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>
                      {expandedCluster === idx && (
                        <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                          <div className="text-xs font-semibold text-slate-600 uppercase mb-2">Keywords in this cluster:</div>
                          <div className="space-y-1.5">
                            {cluster.keywords.map((kw, i) => (
                              <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-slate-100">
                                <div className="font-medium text-slate-800 flex-1 text-sm">{kw.keyword}</div>
                                <div className="font-mono text-xs text-slate-500 w-20 text-right">{kw.volume.toLocaleString()}/mo</div>
                                <span className={`inline-flex w-8 h-5 items-center justify-center text-[10px] font-mono font-semibold rounded border ${getKdBadge(kw.difficulty).color}`}>{getKdBadge(kw.difficulty).label}</span>
                                <span className={`inline-flex w-8 h-5 items-center justify-center text-[10px] font-mono font-semibold rounded border ${getMqlBadge(kw.mqlScore)}`}>{kw.mqlScore}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                            <strong>���� Recommendation:</strong> Build ONE {cluster.dominantPageType.toLowerCase()} targeting "{cluster.name}" as the primary keyword.
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TABLE VIEW */}
              {activeTab !== 'clusters' && (
                sortedData().length > 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            {[
                              { field: 'keyword', label: 'Keyword' },
                              { field: 'volume', label: 'Vol/mo', align: 'right' },
                              { field: 'mqlScore', label: 'MQL', align: 'center' },
                              { field: 'difficulty', label: 'KD', align: 'center' },
                              { field: 'pageType', label: 'Page Type', align: 'left', noSort: true },
                              { field: 'intent', label: 'Intent', align: 'left' },
                              { field: 'serp', label: 'SERP', align: 'left', noSort: true },
                            ].map(col => (
                              <th key={col.field} onClick={() => !col.noSort && toggleSort(col.field)} className={`px-4 py-3 text-${col.align || 'left'} text-[10px] uppercase tracking-wider font-bold text-slate-600 ${!col.noSort ? 'cursor-pointer hover:bg-slate-100' : ''}`}>
                                <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                  {col.label}{sortBy === col.field && (sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedData().map((kw, i) => {
                            const kdBadge = getKdBadge(kw.difficulty);
                            return (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3"><div className="font-medium text-slate-900">{kw.keyword}</div></td>
                                <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-slate-700">{kw.volume.toLocaleString()}</td>
                                <td className="px-4 py-3 text-center"><span className={`inline-flex items-center justify-center w-10 h-6 text-xs font-mono font-semibold rounded border ${getMqlBadge(kw.mqlScore)}`}>{kw.mqlScore}</span></td>
                                <td className="px-4 py-3 text-center"><span className={`inline-flex items-center justify-center w-10 h-6 text-xs font-mono font-semibold rounded border ${kdBadge.color}`}>{kdBadge.label}</span></td>
                                <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 text-[10px] font-medium border rounded ${getPageTypeColor(kw.pageType.code)}`}>{kw.pageType.type}</span></td>
                                <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border rounded ${getIntentBadge(kw.intent)}`}>{kw.intent}</span></td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1 flex-wrap">
                                    {kw.hasAiOverview && (<span title="AI Overview" className="inline-flex items-center text-[9px] font-semibold bg-violet-100 text-violet-800 border border-violet-300 px-1.5 py-0.5 rounded"><Bot size={9} className="mr-0.5" />AI</span>)}
                                    {kw.hasFeaturedSnippet && (<span title="Featured Snippet" className="inline-flex items-center text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded">FS</span>)}
                                    {kw.hasPaa && (<span title="People Also Ask" className="inline-flex items-center text-[9px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.5 rounded">PAA</span>)}
                                    {kw.isLocation && (<span className="inline-flex items-center text-[9px] font-semibold bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.5 rounded">��������</span>)}
                                    {kw.isEmbeeRelevant && (<span className="inline-flex items-center text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">E</span>)}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
                    <div className="text-slate-600 font-medium">No keywords match your filters.</div>
                  </div>
                )
              )}
            </section>
          )}

          {/* Empty state for keyword mode */}
          {!results && !loading && (
            <section className="max-w-[1400px] mx-auto px-6 py-10">
              <div className="mb-10">
                <h2 className="font-serif-d text-3xl text-slate-900 mb-5">Embee's Service Lines</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {serviceLines.slice(1).map((s, i) => (
                    <button key={s.id} onClick={() => { setServiceLine(s.id); setSeedKeyword(s.seeds[0]); }} className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-pink-400 hover:shadow-lg hover:shadow-pink-100/50 transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 group-hover:from-pink-100 group-hover:to-pink-200 rounded-lg flex items-center justify-center text-slate-700 group-hover:text-pink-700 font-bold transition-all">{String(i + 1).padStart(2, '0')}</div>
                      </div>
                      <div className="font-semibold text-slate-900 mb-2">{s.name}</div>
                      <div className="space-y-1">
                        {s.seeds.slice(0, 2).map(seed => (<div key={seed} className="text-xs text-slate-500 font-mono truncate">��� {seed}</div>))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* COMPETITOR MODE */}
      {mode === 'competitor' && (
        <>
          <section className="bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 border-b border-violet-200">
            <div className="max-w-[1400px] mx-auto px-6 pt-6 pb-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 bg-white border border-violet-200 rounded-full px-3 py-1 text-xs text-violet-700 mb-5 shadow-sm">
                  <Swords size={12} />
                  <span className="font-medium">Competitor Intelligence</span>
                  <span className="text-violet-300">��</span>
                  <span className="font-mono">embee.co.in vs ?</span>
                </div>
                <h1 className="font-serif-d text-5xl md:text-6xl text-slate-900 leading-[1.05] tracking-tight">
                  Steal what <span className="italic text-violet-600">they rank for</span>.
                </h1>
                <p className="mt-4 text-slate-600 text-lg max-w-2xl leading-relaxed">
                  Discover keywords your competitors rank for that Embee doesn't. Each gap is a content opportunity for the revamp.
                </p>
              </div>

              <div className="mt-8 bg-white rounded-2xl border border-violet-200 p-5 shadow-xl shadow-violet-200/30 max-w-5xl">
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Pick a competitor</label>
                    <select value={selectedCompetitor} onChange={(e) => { setSelectedCompetitor(e.target.value); setCustomCompetitor(''); }} className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-violet-500 bg-white text-slate-900">
                      {competitors.map(c => (<option key={c} value={c}>{c}</option>))}
                    </select>
                  </div>
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">���or enter custom domain</label>
                    <input type="text" value={customCompetitor} onChange={(e) => setCustomCompetitor(e.target.value)} placeholder="e.g. tcs.com" className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-violet-500 text-slate-900 placeholder:text-slate-400" />
                  </div>
                  <div className="col-span-12 md:col-span-2">
                    <button onClick={fetchCompetitorData} disabled={compLoading} className="w-full bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:from-slate-400 disabled:to-slate-500 flex items-center justify-center gap-2">
                      {compLoading ? <Loader2 size={18} className="animate-spin" /> : <Swords size={16} />}
                      {compLoading ? 'Analyzing' : 'Analyze'}
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-slate-500 italic">
                  ��� Note: Analyzes 2 domains, may take 15-30 seconds. Uses ~6-10 DataForSEO credits per analysis.
                </div>
              </div>

              {compError && (
                <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-900 fade-in max-w-5xl">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <div className="text-sm">{compError}</div>
                </div>
              )}
            </div>
          </section>

          {compLoading && (
            <section className="max-w-[1400px] mx-auto px-6 py-8">
              <div className="text-center py-12">
                <Loader2 size={36} className="animate-spin mx-auto text-violet-600" />
                <div className="mt-4 text-slate-700 font-medium">Crawling SERPs for both domains���</div>
                <div className="text-sm text-slate-500 mt-1">This takes 15-30 seconds ��� finding gaps and overlaps</div>
              </div>
            </section>
          )}

          {compResults && !compLoading && (
            <section className="max-w-[1400px] mx-auto px-6 py-8 fade-in">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                {[
                  { label: 'Competitor', value: compResults.stats.competitor, icon: Building2, color: 'text-violet-700', isString: true },
                  { label: 'Their Top KWs', value: compResults.stats.competitorTopKeywords, icon: Award, color: 'text-purple-700' },
                  { label: 'Embee Indexed', value: compResults.stats.embeeIndexedKeywords, icon: TrendingUp, color: 'text-pink-700' },
                  { label: 'Gap Opportunities', value: compResults.stats.gapCount, icon: Target, color: 'text-rose-700' },
                  { label: 'Gap Volume / mo', value: compResults.stats.gapTotalVolume.toLocaleString(), icon: BarChart3, color: 'text-emerald-700' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
                      <stat.icon size={12} />{stat.label}
                    </div>
                    <div className={`${stat.isString ? 'font-mono text-base' : 'font-serif-d text-3xl'} ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Tab nav */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="inline-flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                  <button onClick={() => setCompTab('gap')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${compTab === 'gap' ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
                    <Target size={14} />Gap Opportunities
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${compTab === 'gap' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{compResults.gap.length}</span>
                  </button>
                  <button onClick={() => setCompTab('overlap')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${compTab === 'overlap' ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>
                    <Swords size={14} />Head-to-Head
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${compTab === 'overlap' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{compResults.overlap.length}</span>
                  </button>
                </div>
                <button onClick={exportCompCSV} className="flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                  <Download size={14} />Export
                </button>
              </div>

              {/* Tab description */}
              <div className={`mb-4 rounded-xl p-4 text-sm ${compTab === 'gap' ? 'bg-violet-50 text-violet-900 border border-violet-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                {compTab === 'gap' && (<><strong>���� Gap Opportunities ���</strong> Keywords <span className="font-mono">{compResults.stats.competitor}</span> ranks for that Embee doesn't show up for. <strong>These are your highest-priority content opportunities</strong> ��� build pages targeting these to steal share. Sort by MQL score to find the highest-value gaps first.</>)}
                {compTab === 'overlap' && (<><strong>������ Head-to-Head Battles ���</strong> Keywords where BOTH Embee and <span className="font-mono">{compResults.stats.competitor}</span> rank in top 50. The "Comp Rank" vs "Embee Rank" columns show who's winning. Focus on overlaps where you're close behind (within 5 positions) ��� those are quick wins to overtake.</>)}
              </div>

              {/* Comp table */}
              {sortedCompData().length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {[
                            { field: 'keyword', label: 'Keyword' },
                            { field: 'volume', label: 'Vol/mo', align: 'right' },
                            { field: 'mqlScore', label: 'MQL', align: 'center' },
                            { field: 'difficulty', label: 'KD', align: 'center' },
                            { field: 'competitorRank', label: 'Comp Rank', align: 'center' },
                            ...(compTab === 'overlap' ? [{ field: 'embeeRank', label: 'Embee Rank', align: 'center' }] : []),
                            { field: 'pageType', label: 'Page Type', align: 'left', noSort: true },
                            { field: 'url', label: 'Their URL', align: 'left', noSort: true },
                          ].map(col => (
                            <th key={col.field} onClick={() => !col.noSort && toggleCompSort(col.field)} className={`px-4 py-3 text-${col.align || 'left'} text-[10px] uppercase tracking-wider font-bold text-slate-600 ${!col.noSort ? 'cursor-pointer hover:bg-slate-100' : ''}`}>
                              <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                {col.label}{compSortBy === col.field && (compSortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCompData().slice(0, 200).map((kw, i) => {
                          const kdBadge = getKdBadge(kw.difficulty);
                          return (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3"><div className="font-medium text-slate-900">{kw.keyword}</div></td>
                              <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-slate-700">{kw.volume.toLocaleString()}</td>
                              <td className="px-4 py-3 text-center"><span className={`inline-flex items-center justify-center w-10 h-6 text-xs font-mono font-semibold rounded border ${getMqlBadge(kw.mqlScore)}`}>{kw.mqlScore}</span></td>
                              <td className="px-4 py-3 text-center"><span className={`inline-flex items-center justify-center w-10 h-6 text-xs font-mono font-semibold rounded border ${kdBadge.color}`}>{kdBadge.label}</span></td>
                              <td className="px-4 py-3 text-center"><span className={`inline-flex items-center justify-center w-10 h-6 text-xs font-mono font-semibold rounded border ${getRankBadge(kw.competitorRank)}`}>#{kw.competitorRank}</span></td>
                              {compTab === 'overlap' && (
                                <td className="px-4 py-3 text-center">
                                  {kw.embeeRank ? (
                                    <span className={`inline-flex items-center justify-center w-10 h-6 text-xs font-mono font-semibold rounded border ${getRankBadge(kw.embeeRank)}`}>#{kw.embeeRank}</span>
                                  ) : (<span className="text-xs text-slate-400">���</span>)}
                                </td>
                              )}
                              <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 text-[10px] font-medium border rounded ${getPageTypeColor(kw.pageType.code)}`}>{kw.pageType.type}</span></td>
                              <td className="px-4 py-3">
                                {kw.competitorUrl ? (
                                  <a href={kw.competitorUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 hover:underline max-w-xs truncate">
                                    <span className="truncate">{kw.competitorUrl.replace(/^https?:\/\/[^\/]+/, '')}</span>
                                    <ExternalLink size={10} className="flex-shrink-0" />
                                  </a>
                                ) : (<span className="text-xs text-slate-400">���</span>)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
                  <div className="text-slate-600 font-medium">No {compTab === 'gap' ? 'gaps' : 'overlaps'} found.</div>
                  <div className="text-sm text-slate-500 mt-1">Try a different competitor or check that the domain is correct.</div>
                </div>
              )}

              <div className="mt-3 text-xs text-slate-500 font-mono">
                Showing top {Math.min(200, sortedCompData().length)} of {sortedCompData().length} {compTab === 'gap' ? 'gap opportunities' : 'overlapping keywords'}
              </div>
            </section>
          )}

          {/* Empty state for competitor mode */}
          {!compResults && !compLoading && (
            <section className="max-w-[1400px] mx-auto px-6 py-10">
              <div className="mb-10 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6">
                <h2 className="font-serif-d text-3xl text-slate-900 mb-2">How Competitor Gap Analysis works</h2>
                <p className="text-sm text-slate-700 mb-5">Pick any competitor ��� we compare their organic search footprint to embee.co.in ��� you get two actionable lists.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-5 border border-violet-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><Target size={16} className="text-violet-700" /></div>
                      <div className="font-semibold text-slate-900">Gap Opportunities</div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">Keywords the competitor ranks for (top 30) where Embee doesn't appear at all. <strong>This is your content roadmap</strong> ��� every gap is a missing page on your site.</p>
                  </div>
                  <div className="bg-white rounded-xl p-5 border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Swords size={16} className="text-amber-700" /></div>
                      <div className="font-semibold text-slate-900">Head-to-Head Battles</div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">Keywords where you AND the competitor both rank. See who's winning, find the close calls (within 5 positions), and prioritize content boosts to overtake them.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={16} className="text-violet-600" />
                    <div className="font-semibold text-slate-900">Available Competitors</div>
                  </div>
                  <div className="space-y-2">
                    {competitors.map(c => (
                      <div key={c} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <span className="font-mono text-sm text-slate-700">{c}</span>
                        <button onClick={() => { setSelectedCompetitor(c); setCustomCompetitor(''); fetchCompetitorData(); }} className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 px-3 py-1 rounded-full transition-colors flex items-center gap-1">
                          Analyze <ArrowRight size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">Or enter any custom domain in the search bar above.</div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white">
                  <div className="font-semibold mb-3 flex items-center gap-2">
                    <Zap size={16} className="text-yellow-400" />
                    Suggested workflow
                  </div>
                  <ol className="space-y-2.5 text-sm text-slate-200 list-decimal list-inside marker:text-violet-400 marker:font-bold">
                    <li>Analyze HCLTech first (largest competitor)</li>
                    <li>Sort gaps by MQL score, take top 50</li>
                    <li>Repeat for Sonata, SoftwareOne, etc.</li>
                    <li>Cross-reference: keywords appearing in 2+ gap lists are <strong>category-defining</strong></li>
                    <li>Build pages for these first ��� they're proven demand</li>
                    <li>Use Head-to-Head to find quick-win overtakes</li>
                  </ol>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-slate-500 font-mono">EMBEE KEYWORD LAB v3 �� INTERNAL USE ONLY</div>
          <div className="text-xs text-slate-500">Data via <span className="font-mono">DataForSEO</span> �� Built for embee.co.in</div>
        </div>
      </footer>
    </div>
  );
}
