'use client';

import React, { useState } from 'react';
import {
  Search, Loader2, AlertCircle, TrendingUp, HelpCircle, Sparkles,
  Download, ChevronDown, ChevronUp, Target, Building2, Zap,
  Filter, BarChart3,
} from 'lucide-react';

export default function KeywordLab() {
  const [seedKeyword, setSeedKeyword] = useState('');
  const [serviceLine, setServiceLine] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('seo');
  const [sortBy, setSortBy] = useState('volume');
  const [sortDir, setSortDir] = useState('desc');
  const [kdFilter, setKdFilter] = useState('all');
  const [volumeFilter, setVolumeFilter] = useState('all');

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
    if (!seedKeyword.trim()) {
      setError('Please enter a seed keyword');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: seedKeyword, locationCode: 2356 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      const items = data.items || [];

      const allKeywords = items.map(item => {
        const kw = item.keyword;
        const intent = item.search_intent_info?.main_intent || 'unknown';
        const isQuestion = /^(what|how|why|when|where|who|can|does|is|are|should|will|do)\s/i.test(kw);
        const isComparison = /\b(vs|versus|compare|comparison|alternative|alternatives|best|top|review|reviews)\b/i.test(kw);
        const isLocation = /\b(india|mumbai|bangalore|delhi|pune|hyderabad|chennai)\b/i.test(kw);
        const isEmbeeRelevant = /\b(azure|microsoft|365|copilot|sap|s4hana|hana|hrms|cloud|cyber|security|managed|it services|data center|fabric|teams|xdr|iam|identity)\b/i.test(kw);

        return {
          keyword: kw,
          volume: item.keyword_info?.search_volume || 0,
          cpc: item.keyword_info?.cpc || 0,
          competition: item.keyword_info?.competition_level || 'UNKNOWN',
          difficulty: item.keyword_properties?.keyword_difficulty || null,
          intent,
          isQuestion,
          isComparison,
          isLocation,
          isEmbeeRelevant,
        };
      });

      const seoKeywords = allKeywords.filter(k => k.volume > 0);
      const aeoKeywords = allKeywords.filter(k => k.isQuestion);
      const geoKeywords = allKeywords.filter(k =>
        k.isComparison ||
        /^(how to|how do|how does|why should)/i.test(k.keyword) ||
        /\balternative|review|pricing|cost\b/i.test(k.keyword)
      );
      const quickWins = allKeywords
        .filter(k => k.difficulty !== null && k.difficulty < 30 && k.volume >= 50 && k.isEmbeeRelevant)
        .sort((a, b) => b.volume - a.volume);

      setResults({
        seo: seoKeywords,
        aeo: aeoKeywords,
        geo: geoKeywords,
        quickWins,
        seed: seedKeyword,
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch keyword data');
    } finally {
      setLoading(false);
    }
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
    const data = activeTab === 'quickwins' ? results.quickWins : results[activeTab];
    const filtered = applyFilters(data);
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (aVal === null) aVal = -1;
      if (bVal === null) bVal = -1;
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return filtered;
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const exportCSV = () => {
    if (!results) return;
    const data = sortedData();
    const headers = ['Keyword', 'Volume', 'CPC (INR)', 'Competition', 'KD', 'Intent', 'Embee Relevant'];
    const rows = data.map(k => [
      `"${k.keyword}"`,
      k.volume,
      (k.cpc * 83).toFixed(0),
      k.competition,
      k.difficulty ?? 'N/A',
      k.intent,
      k.isEmbeeRelevant ? 'Yes' : 'No',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `embee-${results.seed.replace(/\s+/g, '-')}-${activeTab}.csv`;
    a.click();
  };

  const getKdBadge = (score) => {
    if (score === null || score === undefined) return { label: '—', color: 'bg-slate-100 text-slate-500' };
    if (score < 30) return { label: score, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (score < 60) return { label: score, color: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { label: score, color: 'bg-red-100 text-red-800 border-red-300' };
  };

  const getIntentBadge = (intent) => {
    const colors = {
      informational: 'bg-blue-50 text-blue-700 border-blue-200',
      commercial: 'bg-amber-50 text-amber-700 border-amber-200',
      transactional: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      navigational: 'bg-violet-50 text-violet-700 border-violet-200',
      unknown: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    return colors[intent] || colors.unknown;
  };

  const tabs = [
    { id: 'seo', label: 'SEO', icon: TrendingUp },
    { id: 'aeo', label: 'AEO', icon: HelpCircle },
    { id: 'geo', label: 'GEO', icon: Sparkles },
    { id: 'quickwins', label: 'Quick Wins', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-lg bg-white/80">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">E</div>
            <div>
              <div className="font-bold text-slate-900 leading-none">Embee Keyword Lab</div>
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">Internal · India Market</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 border border-emerald-200 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            API Connected · DataForSEO
          </div>
        </div>
      </header>

      <section className="gradient-mesh">
        <div className="max-w-[1400px] mx-auto px-6 pt-10 pb-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs text-slate-600 mb-5 shadow-sm">
              <Target size={12} className="text-pink-600" />
              <span className="font-medium">Targeting:</span>
              <span className="font-mono">embee.co.in · India</span>
            </div>
            <h1 className="font-serif-d text-5xl md:text-6xl text-slate-900 leading-[1.05] tracking-tight">
              Find the keywords<br />
              <span className="italic text-pink-600">India</span> is searching for.
            </h1>
            <p className="mt-4 text-slate-600 text-lg max-w-2xl leading-relaxed">
              Unified keyword research across SEO, AEO, and GEO — tailored to Embee's service lines and the Indian market.
            </p>
          </div>

          <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-xl shadow-slate-200/50 max-w-5xl">
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 md:col-span-7">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Seed Keyword</label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={seedKeyword}
                    onChange={(e) => setSeedKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchKeywordData()}
                    placeholder="e.g. microsoft 365 business plans"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Service Line</label>
                <select
                  value={serviceLine}
                  onChange={(e) => setServiceLine(e.target.value)}
                  className="w-full px-3 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-pink-500 bg-white text-slate-900"
                >
                  {serviceLines.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>
              <div className="col-span-12 md:col-span-2">
                <button
                  onClick={fetchKeywordData}
                  disabled={loading}
                  className="w-full bg-gradient-to-br from-pink-500 to-rose-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:shadow-pink-500/30 transition-all disabled:from-slate-400 disabled:to-slate-500 flex items-center justify-center gap-2"
                >
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
                    <button
                      key={s}
                      onClick={() => setSeedKeyword(s)}
                      className="text-xs bg-slate-100 hover:bg-pink-50 hover:text-pink-700 text-slate-700 px-3 py-1 rounded-full transition-colors border border-transparent hover:border-pink-200"
                    >{s}</button>
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
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (<div key={i} className="h-14 rounded-lg shimmer"></div>))}
          </div>
        </section>
      )}

      {results && !loading && (
        <section className="max-w-[1400px] mx-auto px-6 py-8 fade-in">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total Keywords', value: results.seo.length, icon: BarChart3, color: 'text-slate-700' },
              { label: 'Questions (AEO)', value: results.aeo.length, icon: HelpCircle, color: 'text-blue-700' },
              { label: 'Comparison (GEO)', value: results.geo.length, icon: Sparkles, color: 'text-violet-700' },
              { label: 'Quick Wins', value: results.quickWins.length, icon: Zap, color: 'text-emerald-700' },
              { label: 'Total Volume / mo', value: results.seo.reduce((s, k) => s + k.volume, 0).toLocaleString(), icon: TrendingUp, color: 'text-pink-700' },
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
            <div className="inline-flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              {tabs.map(tab => {
                const count = tab.id === 'quickwins' ? results.quickWins.length : results[tab.id].length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === tab.id
                      ? tab.id === 'quickwins'
                        ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md'
                        : 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <tab.icon size={14} />{tab.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
                <Filter size={12} className="text-slate-400 ml-1" />
                <select value={kdFilter} onChange={(e) => setKdFilter(e.target.value)} className="text-xs bg-transparent border-0 focus:outline-none px-1 py-1 font-medium">
                  <option value="all">All KD</option>
                  <option value="easy">Easy (&lt;30)</option>
                  <option value="medium">Medium (30-60)</option>
                  <option value="hard">Hard (60+)</option>
                </select>
                <div className="w-px h-4 bg-slate-200"></div>
                <select value={volumeFilter} onChange={(e) => setVolumeFilter(e.target.value)} className="text-xs bg-transparent border-0 focus:outline-none px-1 py-1 font-medium">
                  <option value="all">All Volume</option>
                  <option value="high">High (1000+)</option>
                  <option value="medium">Medium (100-1K)</option>
                  <option value="low">Low (&lt;100)</option>
                </select>
              </div>
              <button onClick={exportCSV} className="flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                <Download size={14} />Export
              </button>
            </div>
          </div>

          <div className={`mb-4 rounded-xl p-4 text-sm ${activeTab === 'seo' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
            activeTab === 'aeo' ? 'bg-blue-50 text-blue-900 border border-blue-200' :
              activeTab === 'geo' ? 'bg-violet-50 text-violet-900 border border-violet-200' :
                'bg-emerald-50 text-emerald-900 border border-emerald-200'
            }`}>
            {activeTab === 'seo' && (<><strong>Traditional Search —</strong> All keywords ranked by search volume. Best for content that needs to rank on Google.</>)}
            {activeTab === 'aeo' && (<><strong>Answer Engine Optimization —</strong> Question-based queries perfect for featured snippets, People Also Ask, and voice search.</>)}
            {activeTab === 'geo' && (<><strong>Generative Engine Optimization —</strong> Comparison queries where competitors like Sonata, SoftwareOne, G7CR, Noventiq, HCLTech get cited in AI answers.</>)}
            {activeTab === 'quickwins' && (<><strong>Quick Wins —</strong> Low difficulty (under 30) + decent volume + Embee-relevant. Prioritize these for 3-6 month ranking plays.</>)}
          </div>

          {sortedData().length > 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {[
                        { field: 'keyword', label: 'Keyword' },
                        { field: 'volume', label: 'Volume/mo', align: 'right' },
                        { field: 'cpc', label: 'CPC (₹)', align: 'right' },
                        { field: 'difficulty', label: 'KD', align: 'center' },
                        { field: 'intent', label: 'Intent', align: 'left' },
                        { field: 'competition', label: 'Comp.', align: 'left' },
                        { field: 'tags', label: 'Signals', align: 'left' },
                      ].map(col => (
                        <th key={col.field} onClick={() => col.field !== 'tags' && toggleSort(col.field)} className={`px-4 py-3 text-${col.align || 'left'} text-[10px] uppercase tracking-wider font-bold text-slate-600 ${col.field !== 'tags' ? 'cursor-pointer hover:bg-slate-100' : ''}`}>
                          <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                            {col.label}
                            {sortBy === col.field && (sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
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
                          <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-slate-600">₹{(kw.cpc * 83).toFixed(0)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center w-10 h-6 text-xs font-mono font-semibold rounded border ${kdBadge.color}`}>{kdBadge.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border rounded ${getIntentBadge(kw.intent)}`}>{kw.intent}</span>
                          </td>
                          <td className="px-4 py-3"><span className="text-xs text-slate-500 font-mono">{kw.competition.toLowerCase()}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {kw.isEmbeeRelevant && (<span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.5 rounded"><Target size={8} /> EMBEE</span>)}
                              {kw.isLocation && (<span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">🇮🇳 LOCAL</span>)}
                              {kw.isComparison && (<span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded"><Sparkles size={8} /> GEO</span>)}
                              {kw.isQuestion && (<span className="inline-flex items-center gap-1 text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded"><HelpCircle size={8} /> Q</span>)}
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
              <div className="text-sm text-slate-500 mt-1">Try loosening KD or volume filters, or switch tabs.</div>
            </div>
          )}

          <div className="mt-3 text-xs text-slate-500 font-mono">
            Showing {sortedData().length} of {activeTab === 'quickwins' ? results.quickWins.length : results[activeTab].length} keywords
          </div>
        </section>
      )}

      {!results && !loading && (
        <section className="max-w-[1400px] mx-auto px-6 py-10">
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-serif-d text-3xl text-slate-900">Embee's Service Lines</h2>
              <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">6 pillars · India focused</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {serviceLines.slice(1).map((s, i) => (
                <button key={s.id} onClick={() => { setServiceLine(s.id); setSeedKeyword(s.seeds[0]); }} className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-pink-400 hover:shadow-lg hover:shadow-pink-100/50 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 group-hover:from-pink-100 group-hover:to-pink-200 rounded-lg flex items-center justify-center text-slate-700 group-hover:text-pink-700 font-bold transition-all">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{s.seeds.length} seeds</div>
                  </div>
                  <div className="font-semibold text-slate-900 mb-2">{s.name}</div>
                  <div className="space-y-1">
                    {s.seeds.slice(0, 2).map(seed => (<div key={seed} className="text-xs text-slate-500 font-mono truncate">↳ {seed}</div>))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-10">
            <h2 className="font-serif-d text-3xl text-slate-900 mb-5">Three Research Lenses</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: TrendingUp, title: 'SEO', subtitle: 'Search Engine Optimization', desc: 'Volume, difficulty, and CPC data for ranking on Google India.', gradient: 'from-slate-900 to-slate-700' },
                { icon: HelpCircle, title: 'AEO', subtitle: 'Answer Engine Optimization', desc: 'Question-based queries for featured snippets, PAA, and voice search.', gradient: 'from-blue-600 to-blue-800' },
                { icon: Sparkles, title: 'GEO', subtitle: 'Generative Engine Optimization', desc: 'Comparison queries that LLMs cite — beat Sonata, SoftwareOne, G7CR, Noventiq, HCLTech in AI answers.', gradient: 'from-violet-600 to-pink-600' },
              ].map((lens, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className={`bg-gradient-to-br ${lens.gradient} p-5 text-white`}>
                    <lens.icon size={28} strokeWidth={1.5} className="mb-3" />
                    <div className="font-serif-d text-3xl">{lens.title}</div>
                    <div className="text-xs opacity-80 font-mono uppercase tracking-wider">{lens.subtitle}</div>
                  </div>
                  <div className="p-5 text-sm text-slate-700 leading-relaxed">{lens.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-pink-600" />
                <div className="font-semibold text-slate-900">Tracked Competitors</div>
              </div>
              <div className="space-y-2">
                {competitors.map(c => (
                  <div key={c} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="font-mono text-sm text-slate-700">{c}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">monitored</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-500 leading-relaxed">
                These competitors currently outrank Embee for several target keywords. Use the GEO tab to find comparison queries where you can displace them in AI responses.
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <Zap size={16} className="text-yellow-400" />
                How to use this tool
              </div>
              <ol className="space-y-2.5 text-sm text-slate-200 list-decimal list-inside marker:text-pink-400 marker:font-bold">
                <li>Pick a service line or enter your own seed keyword</li>
                <li>Hit "Research" — results load in 3-5 seconds</li>
                <li>Review the <span className="text-yellow-400 font-semibold">Quick Wins</span> tab first (lowest hanging fruit)</li>
                <li>Check AEO for FAQ opportunities on your solution pages</li>
                <li>Use GEO queries to build content that wins in AI answers</li>
                <li>Export to CSV and share with content team</li>
              </ol>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-[1400px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-slate-500 font-mono">EMBEE KEYWORD LAB · INTERNAL USE ONLY</div>
          <div className="text-xs text-slate-500">Data via <span className="font-mono">DataForSEO</span> · Built for embee.co.in</div>
        </div>
      </footer>
    </div>
  );
}
