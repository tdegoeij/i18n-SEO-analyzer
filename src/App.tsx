import { useState, useEffect } from 'react';
import { Search, Globe, FileX, Link, RefreshCw, LogOut, ChevronDown, Check, Download, AlertTriangle, CheckCircle, ExternalLink, Activity, Zap } from 'lucide-react';

const API_BASE_URL = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8000'
  : 'https://i18n-seo-analyzer-3d2678f53f5d.herokuapp.com'; 

interface Language {
  code: string;
  name: string;
}

interface PageData {
  impressions: number;
  topKeyword: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [clusters, setClusters] = useState<any[]>([]);
  
  const [gscData, setGscData] = useState<Record<string, PageData>>({});
  const [lastmods, setLastmods] = useState<Record<string, string>>({});
  
  const [scanResults, setScanResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  
  const [activeTab, setActiveTab] = useState('optimizer');
  const [llmUrl, setLlmUrl] = useState('');
  const [llmKeyword, setLlmKeyword] = useState('');
  const [llmData, setLlmData] = useState<any>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const localToken = localStorage.getItem('gsc_token');

    if (urlToken) {
      setToken(urlToken);
      localStorage.setItem('gsc_token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchData(urlToken);
    } else if (localToken) {
      setToken(localToken);
      fetchData(localToken);
    }
  }, []);

  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/login`;
  };

  const handleLogout = () => {
    localStorage.removeItem('gsc_token');
    setToken(null);
    setLanguages([]);
    setGscData({});
    setClusters([]);
    setScanResults(null);
  };

  const fetchData = async (authToken: string) => {
    setLoading(true);
    setProgress(0);
    setProgressMsg('Initializing connection...');
    
    setGscData({});
    setClusters([]);
    setLastmods({});
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/data?force_refresh=false`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!response.ok) {
        if (response.status === 401) handleLogout();
        throw new Error('Data fetch failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // ROBUST BRACKET-COUNTING PARSER
        // Completely ignores missing newlines (}{) and safely parses chunks as they complete
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let startIndex = -1;
        let lastValidIndex = 0;

        for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];
            
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; continue; }

            if (!inString) {
                if (char === '{') {
                    if (depth === 0) startIndex = i;
                    depth++;
                } else if (char === '}') {
                    depth--;
                    // The exact moment a JSON object is perfectly closed
                    if (depth === 0 && startIndex !== -1) {
                        const jsonStr = buffer.substring(startIndex, i + 1);
                        try {
                            const data = JSON.parse(jsonStr);
                            
                            if (data.status === 'progress') {
                              setProgress(prev => Math.min(prev + 5, 90));
                              setProgressMsg(data.message);
                            } 
                            else if (data.status === 'gsc_chunk') {
                              setGscData(prev => ({ ...prev, ...data.result }));
                            }
                            else if (data.status === 'complete') {
                              const langs: Language[] = data.result.languages.map((l: string) => ({ code: l, name: l.toUpperCase() }));
                              setLanguages(langs);
                              if (langs.length > 0) setSelectedLang(langs[0]);
                              setClusters(data.result.clusters || []);
                              setLastmods(data.result.lastmods || {});
                              setProgress(100);
                              setProgressMsg('Data loaded successfully!');
                              setTimeout(() => setLoading(false), 1000);
                            }
                        } catch (e) {
                            console.error("Parse error on chunk:", e);
                        }
                        
                        lastValidIndex = i + 1;
                        startIndex = -1;
                    }
                }
            }
        }
        
        // Immediately shrink the buffer to free RAM and prevent crashes
        if (lastValidIndex > 0) {
            buffer = buffer.substring(lastValidIndex);
        }
      }

    } catch (error) {
      console.error(error);
      setProgressMsg('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const runFullScan = async () => {
    if (!selectedLang) return;
    setLoading(true);
    setProgress(0);
    setProgressMsg('Initializing deep scan crawler...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/scan_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            siteUrl: 'https://lucid.co/', 
            targetLang: selectedLang.code,
            target_lang: selectedLang.code
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let startIndex = -1;
        let lastValidIndex = 0;

        for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (char === '\\') { escapeNext = true; continue; }
            if (char === '"') { inString = !inString; continue; }

            if (!inString) {
                if (char === '{') {
                    if (depth === 0) startIndex = i;
                    depth++;
                } else if (char === '}') {
                    depth--;
                    if (depth === 0 && startIndex !== -1) {
                        const jsonStr = buffer.substring(startIndex, i + 1);
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.progress) setProgress(data.progress);
                            if (data.message) setProgressMsg(data.message);
                            if (data.result) {
                              setScanResults(data.result);
                              setTimeout(() => setLoading(false), 1000);
                            }
                        } catch (e) {}
                        lastValidIndex = i + 1;
                        startIndex = -1;
                    }
                }
            }
        }
        if (lastValidIndex > 0) buffer = buffer.substring(lastValidIndex);
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const runLlmOptimization = async () => {
    if (!llmUrl) return;
    setLlmLoading(true);
    try {
      const [aisoRes, onpageRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/analyze_aiso?url=${encodeURIComponent(llmUrl)}`),
        fetch(`${API_BASE_URL}/api/analyze_onpage?url=${encodeURIComponent(llmUrl)}&keyword=${encodeURIComponent(llmKeyword)}`)
      ]);
      
      const aisoData = await aisoRes.json();
      const onpageData = await onpageRes.json();
      
      setLlmData({
        ...aisoData,
        onpage: onpageData
      });
    } catch (error) {
      console.error(error);
    }
    setLlmLoading(false);
  };

  const exportLlmCsv = () => {
    if (!llmData) return;
    const headers = ['Type', 'Title', 'Description'];
    const rows = llmData.recommendations.map((r: any) => 
      `"${r.type}","${r.title}","${r.desc.replace(/"/g, '""')}"`
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `llm-optimizer-${llmUrl.split('/').pop() || 'report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRedirectSource = (url: string) => {
      if (!scanResults) return false;
      return scanResults.redirects?.some((r: any) => r.originalUrl === url);
  };
  
  const isEnglishUrl = (url: string) => {
      if (!url) return false;
      const path = url.replace('https://lucid.co', '');
      return !path.match(/^\/[a-z]{2}(-[a-z]{2})?\//i);
  };

  const getSafeGsc = (url: string | null | undefined): PageData => {
    if (!url || !gscData) return { impressions: 0, topKeyword: 'N/A' };
    return gscData[url] || { impressions: 0, topKeyword: 'N/A' };
  };

  const getFilteredData = () => {
    if (!selectedLang) return { freshness: [], missing: [], optimizations: [], linking: [], brokenLinks: [] };

    const safeLastmods = lastmods || {};
    const safeClusters = clusters || [];

    const freshness = safeClusters
      .filter(c => c && c[selectedLang.code] && !isRedirectSource(c[selectedLang.code]))
      .map((c, i) => {
        const localUrl = c[selectedLang.code];
        const lastModStr = safeLastmods[localUrl] || safeLastmods[c.en] || null;
        
        let isStale = false;
        let daysOld = 0;
        if (lastModStr) {
            const diffTime = Math.abs(new Date().getTime() - new Date(lastModStr).getTime());
            daysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isStale = daysOld > 90;
        } else {
            isStale = true;
        }
        
        const pageGsc = getSafeGsc(localUrl);
        
        return {
            id: `fresh-${i}`,
            url: localUrl,
            lastMod: lastModStr,
            daysOld,
            isStale,
            impressions: pageGsc.impressions || 0
        };
      });

    const missing = safeClusters
      .filter(c => c && c.en && isEnglishUrl(c.en) && !c[selectedLang.code] && !isRedirectSource(c.en))
      .map((c, i) => {
        const enGsc = getSafeGsc(c.en);
        return {
          id: `missing-${i}`,
          enUrl: c.en,
          globalImpressions: enGsc.impressions || 0,
          topKeyword: enGsc.topKeyword || 'N/A',
          action: 'Translate'
        };
      });

    const optimizations = safeClusters
      .filter(c => c && c[selectedLang.code] && !isRedirectSource(c[selectedLang.code]))
      .map((c, i) => {
        const localUrl = c[selectedLang.code];
        const enUrlFallback = c.en || localUrl;
        const localData = getSafeGsc(localUrl);
        return {
          id: `opt-${i}`,
          enUrl: enUrlFallback,
          localizedUrls: c,
          localImpressions: { [selectedLang.code]: localData.impressions || 0 },
          localTopKeyword: { [selectedLang.code]: localData.topKeyword || 'N/A' },
          recommendedAction: (localData.impressions || 0) > 0 ? 'Expand Content' : 'Analyze'
        };
      });

    let linking: any[] = [];
    if (scanResults?.opportunities) {
        linking = scanResults.opportunities.map((opp: any, i: number) => ({
            id: `link-${i}`,
            enUrl: opp.enLink,
            localizedUrls: { [selectedLang.code]: opp.source },
            linksToEn: 1,
            i18nTarget: opp.i18nLink
        }));
    }

    let brokenLinks: any[] = [];
    if (scanResults?.brokenLinks) {
        brokenLinks = scanResults.brokenLinks.map((bl: any, i: number) => ({
            id: `broken-${i}`,
            enUrl: bl.brokenLink,
            localizedUrls: { [selectedLang.code]: bl.source },
            brokenLinksCount: 1
        }));
    }

    return {
      freshness: freshness.sort((a, b) => b.impressions - a.impressions),
      missing: missing.sort((a, b) => b.globalImpressions - a.globalImpressions),
      optimizations: optimizations.sort((a, b) => (b.localImpressions[selectedLang.code] || 0) - (a.localImpressions[selectedLang.code] || 0)),
      linking,
      brokenLinks
    };
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Globe className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">Enterprise i18n SEO</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">Connect your Google Search Console account to analyze translation opportunities and crawl international site structures.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-4 rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
          >
            <Activity className="w-5 h-5" />
            Connect Search Console
          </button>
        </div>
      </div>
    );
  }

  const filteredData = getFilteredData();

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar Navigation */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 relative">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 text-blue-600 font-bold text-xl tracking-tight">
            <Globe className="w-7 h-7" />
            <span>i18n Analyzer</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-4">AI & Search</div>
          <button onClick={() => setActiveTab('optimizer')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'optimizer' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Zap className="w-4 h-4" /> LLM Optimizer
          </button>
          
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-8">International Data</div>
          {[
            { id: 'optimizations', label: 'Keyword Analysis', icon: Search },
            { id: 'freshness', label: 'Content Freshness', icon: Activity },
            { id: 'missing', label: 'Missing Translations', icon: Globe },
            { id: 'linking', label: 'Cross-linking', icon: Link },
            { id: 'errors', label: '404 Pages', icon: FileX }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'errors' && filteredData.brokenLinks.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs font-bold">
                  {filteredData.brokenLinks.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={() => fetchData(token)} className="w-full flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 font-medium p-2 rounded-lg hover:bg-blue-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Refresh Site Data
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 font-medium p-2 mt-1 rounded-lg hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" /> Disconnect
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm z-20">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            {activeTab === 'optimizer' ? 'LLM Output Optimizer' : 
             activeTab === 'freshness' ? 'Content Freshness Hub' :
             activeTab === 'missing' ? 'Translation Opportunities' :
             activeTab === 'linking' ? 'Internal Link Graph' :
             activeTab === 'errors' ? 'Crawl Diagnostics' : 'Keyword Matrix'}
          </h2>
          
          <div className="flex items-center gap-4">
            {activeTab !== 'optimizer' && languages.length > 0 && selectedLang && (
              <>
                <div className="relative">
                  <button 
                    onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                    className="flex items-center gap-3 bg-white border border-slate-200 hover:border-blue-400 py-2 px-4 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase">
                        {selectedLang.code}
                      </span>
                      {selectedLang.name}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isLangDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsLangDropdownOpen(false)}></div>
                      <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Select Market
                        </div>
                        <div className="max-h-64 overflow-y-auto p-1">
                          {languages.map(l => (
                            <button 
                              key={l.code} 
                              onClick={() => { setSelectedLang(l); setIsLangDropdownOpen(false); }} 
                              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${selectedLang.code === l.code ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${selectedLang.code === l.code ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'}`}>
                                  {l.code}
                                </span>
                                <span className={`text-sm ${selectedLang.code === l.code ? 'font-semibold text-blue-700' : 'font-medium text-slate-700'}`}>
                                  {l.name}
                                </span>
                              </div>
                              {selectedLang.code === l.code && <Check className="w-4 h-4 text-blue-600" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                <button
                  onClick={runFullScan}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-5 rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center gap-2"
                >
                  <Activity className="w-4 h-4" />
                  Run Deep Scan
                </button>
              </>
            )}
          </div>
        </header>

        {/* Progress Bar Component */}
        {loading && (
          <div className="absolute top-0 left-0 right-0 z-50">
            <div className="h-1.5 w-full bg-blue-100 overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300 ease-out rounded-r-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur text-white text-xs font-medium px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {progressMsg} ({Math.round(progress)}%)
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50/50 relative">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* LLM Optimizer View */}
            {activeTab === 'optimizer' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target URL (English or Translated)</label>
                      <input 
                        type="url" 
                        value={llmUrl} 
                        onChange={(e) => setLlmUrl(e.target.value)} 
                        placeholder="https://lucid.co/nl/blog/..." 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Primary Keyword</label>
                      <input 
                        type="text" 
                        value={llmKeyword} 
                        onChange={(e) => setLlmKeyword(e.target.value)} 
                        placeholder="e.g. flowcharts" 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
                      />
                    </div>
                    <button 
                      onClick={runLlmOptimization} 
                      disabled={llmLoading || !llmUrl}
                      className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 mb-[1px]"
                    >
                      {llmLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {llmLoading ? 'Analyzing...' : 'Analyze Page'}
                    </button>
                  </div>
                </div>

                {llmData && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 md:col-span-1 flex flex-col items-center justify-center text-center">
                        <div className="w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4 transition-colors duration-700" 
                             style={{ borderColor: llmData.score > 80 ? '#22c55e' : llmData.score > 50 ? '#eab308' : '#ef4444' }}>
                          <span className="text-4xl font-bold text-slate-800">{llmData.score}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">AISO Score</h3>
                        <p className="text-sm text-slate-500 mt-1">Readiness for ChatGPT, Perplexity & Google AI Overviews.</p>
                      </div>

                      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                           <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <Activity className="w-5 h-5 text-blue-500" />
                             Raw Signals Detected
                           </h3>
                           <button onClick={exportLlmCsv} className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-600 py-1.5 px-3 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm">
                             <Download className="w-3 h-3" /> Export Report
                           </button>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-y-6 gap-x-4">
                           <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Structured Data (JSON-LD)</p>
                              {llmData.raw_data?.schema_types?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {llmData.raw_data.schema_types.map((type: string) => (
                                    <span key={type} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-semibold">{type}</span>
                                  ))}
                                </div>
                              ) : <span className="text-sm text-slate-500">None detected</span>}
                           </div>
                           <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Content Structure</p>
                              <div className="flex flex-col gap-1 text-sm">
                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                  <span className="text-slate-600">Paragraph Density</span>
                                  <span className="font-semibold text-slate-800">{llmData.raw_data?.paragraph_density || 0} words/p</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                  <span className="text-slate-600">HTML Lists</span>
                                  <span className="font-semibold text-slate-800">{llmData.raw_data?.list_count || 0} found</span>
                                </div>
                              </div>
                           </div>
                           <div className="col-span-2">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Freshness Indicators</p>
                              {llmData.raw_data?.freshness_signals && Object.keys(llmData.raw_data.freshness_signals).length > 0 ? (
                                <div className="flex flex-wrap gap-3">
                                  {Object.entries(llmData.raw_data.freshness_signals).map(([key, val]) => (
                                    <div key={key} className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                      <span className="text-emerald-600 font-medium text-xs">{key}:</span>
                                      <span className="text-emerald-800 text-sm font-semibold">{val as string}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-sm text-slate-500">No date tags found in HTML</span>}
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="font-bold text-slate-800">Actionable Recommendations</h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {llmData.recommendations.map((rec: any, idx: number) => (
                          <div key={idx} className="p-5 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                            {rec.type === 'success' ? (
                              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                <CheckCircle className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                            )}
                            <div>
                              <h4 className={`font-semibold text-base mb-1 ${rec.type === 'success' ? 'text-emerald-800' : 'text-amber-800'}`}>{rec.title}</h4>
                              <p className="text-slate-600 text-sm leading-relaxed">{rec.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Freshness View Table */}
            {activeTab === 'freshness' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                      <tr>
                        <th className="p-4 rounded-tl-2xl">URL</th>
                        <th className="p-4">Last Modified</th>
                        <th className="p-4">Staleness</th>
                        <th className="p-4 rounded-tr-2xl">Impressions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredData.freshness.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 max-w-sm truncate">
                             <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1.5 font-medium">
                              {page.url.replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-500">{page.lastMod ? page.lastMod.split('T')[0] : 'N/A'}</td>
                          <td className="p-4">
                             {page.isStale ? (
                                <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
                                  <AlertTriangle className="w-3 h-3" /> &gt; 90 Days
                                </span>
                             ) : (
                                <span className="inline-flex items-center gap-1 py-1 px-2.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">
                                  <CheckCircle className="w-3 h-3" /> Fresh
                                </span>
                             )}
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{page.impressions.toLocaleString()}</td>
                        </tr>
                      ))}
                      {filteredData.freshness.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-500">No localized freshness data found for this market.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Missing Translations Table */}
            {activeTab === 'missing' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                      <tr>
                        <th className="p-4">English URL</th>
                        <th className="p-4">Global Volume</th>
                        <th className="p-4">Top Query</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredData.missing.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 max-w-sm truncate text-slate-800 font-medium">{page.enUrl.replace('https://lucid.co', '')}</td>
                          <td className="p-4 font-semibold">{page.globalImpressions.toLocaleString()}</td>
                          <td className="p-4 text-xs font-mono bg-slate-50/50">"{page.topKeyword}"</td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm cursor-pointer hover:bg-blue-100 transition-colors">
                              <Globe className="w-3 h-3" /> Translate
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Keyword Analysis View Table */}
            {activeTab === 'optimizations' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                      <tr>
                        <th className="p-4">Localized URL</th>
                        <th className="p-4">Local Impressions</th>
                        <th className="p-4">Top Query</th>
                        <th className="p-4">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredData.optimizations.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 max-w-sm truncate">
                             <a href={page.localizedUrls?.[selectedLang?.code || '']} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1.5 font-medium">
                              {(page.localizedUrls?.[selectedLang?.code || ''] || page.enUrl).replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3" />
                            </a>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              Origin: {page.enUrl.replace('https://lucid.co', '')}
                            </div>
                          </td>
                          <td className="p-4 font-semibold text-slate-800">
                            {page.localImpressions?.[selectedLang?.code || '']?.toLocaleString() || 0}
                          </td>
                          <td className="p-4 font-mono text-xs text-indigo-700 bg-indigo-50/50 rounded-lg shadow-inner">
                            "{page.localTopKeyword?.[selectedLang?.code || ''] || 'N/A'}"
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                              {page.recommendedAction}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Internal Linking Graph View */}
            {activeTab === 'linking' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                {scanResults ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                          <th className="p-4">Source Page</th>
                          <th className="p-4">English Hardcoded Link</th>
                          <th className="p-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredData.linking.map((page) => (
                          <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium text-slate-800">
                               {(page.localizedUrls?.[selectedLang?.code || ''] || page.enUrl).replace('https://lucid.co', '')}
                            </td>
                            <td className="p-4 text-slate-500 font-mono text-xs">
                              {page.enUrl.replace('https://lucid.co', '')}
                            </td>
                            <td className="p-4">
                               <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-sm cursor-pointer hover:bg-purple-100 transition-colors">
                                 <Link className="w-3 h-3" /> Update Link
                               </span>
                            </td>
                          </tr>
                        ))}
                        {filteredData.linking.length === 0 && (
                          <tr><td colSpan={3} className="p-8 text-center text-slate-500">Perfect! No English links found on these localized pages.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <Link className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Deep Scan Required</h3>
                    <p className="text-slate-500 mb-6 max-w-sm">To analyze internal links and architecture, the crawler needs to index the site.</p>
                    <button onClick={runFullScan} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-xl shadow-md transition-all">
                      Run Deep Scan Now
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Diagnostics View Table */}
            {activeTab === 'errors' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                {scanResults ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                          <th className="p-4">Broken 404 Link</th>
                          <th className="p-4">Found On Source Page</th>
                          <th className="p-4">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredData.brokenLinks.map((page) => (
                          <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 max-w-sm truncate text-red-600 font-medium">
                              {page.enUrl.replace('https://lucid.co', '')}
                            </td>
                            <td className="p-4 max-w-sm truncate text-slate-500 font-mono text-xs">
                               <a href={page.localizedUrls?.[selectedLang?.code || ''] || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                {(page.localizedUrls?.[selectedLang?.code || ''] || '').replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3 inline" />
                              </a>
                            </td>
                            <td className="p-4">
                               <span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200 shadow-sm cursor-pointer hover:bg-red-100 transition-colors">
                                 <FileX className="w-3 h-3" /> Fix 404
                               </span>
                            </td>
                          </tr>
                        ))}
                        {filteredData.brokenLinks.length === 0 && (
                          <tr><td colSpan={3} className="p-8 text-center text-slate-500">Amazing! No broken links detected during the crawl.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <FileX className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Deep Scan Required</h3>
                    <p className="text-slate-500 mb-6 max-w-sm">We need to crawl the site infrastructure to find 404 pages and dead links.</p>
                    <button onClick={runFullScan} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-xl shadow-md transition-all">
                      Run Deep Scan Now
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}