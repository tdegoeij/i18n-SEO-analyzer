import { useState, useEffect } from 'react';
import { 
  AlertCircle, CheckCircle2, ChevronRight, ExternalLink, 
  Globe2, Link as LinkIcon, Search, LogOut, 
  FileText, BrainCircuit, Activity, ArrowRight,
  ShieldAlert, RefreshCcw
} from 'lucide-react';

const API_BASE_URL = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8000'
  : 'https://i18n-seo-analyzer-3d2678f53f5d.herokuapp.com';

// Define the interface for a Language object
interface Language {
  code: string;
  name: string;
}

export default function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  // token state removed as it was unused in render

  // Data State - explicitly type languages as an array of Language objects
  const [languages, setLanguages] = useState<Language[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [gscData, setGscData] = useState<any>({});
  const [scanResults, setScanResults] = useState<any>(null);

  // UI State
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [activeTab, setActiveTab] = useState('llm');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // AISO State (LLM Optimizer)
  const [aisoUrl, setAisoUrl] = useState('');
  const [aisoKeyword, setAisoKeyword] = useState('');
  const [aisoResult, setAisoResult] = useState<any>(null);
  const [isAisoLoading, setIsAisoLoading] = useState(false);

  // Safely gets the array of items for the active tab to prevent indexing compile issues
  const getActiveTabArray = (): any[] => {
    switch (activeTab) {
      case 'optimizations': return filteredData.optimizations;
      case 'missing': return filteredData.missing;
      case 'linking': return filteredData.linking;
      case 'broken': return filteredData.brokenLinks;
      case 'redirects': return filteredData.redirects;
      default: return [];
    }
  };

  // Maps active tab identifiers to beautiful visual display titles
  const getTabTitle = (): string => {
    switch (activeTab) {
      case 'llm': return 'LLM Content Optimizer';
      case 'optimizations': return 'Keyword Analysis';
      case 'missing': return 'Content Gaps';
      case 'linking': return 'Link Updates';
      case 'broken': return '404 Finder';
      case 'redirects': return 'Redirect Chains';
      default: return activeTab;
    }
  };

  useEffect(() => {
    // Check URL for token after OAuth callback
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    
    if (urlToken) {
      localStorage.setItem('gsc_token', urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticated(true);
      fetchBaseData(urlToken);
    } else {
      const storedToken = localStorage.getItem('gsc_token');
      if (storedToken) {
        setIsAuthenticated(true);
        fetchBaseData(storedToken);
      }
    }
  }, []);

  const handleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/login`;
  };

  const handleLogout = () => {
    localStorage.removeItem('gsc_token');
    setIsAuthenticated(false);
    setLanguages([]);
    setClusters([]);
    setGscData({});
    setScanResults(null);
    setSelectedLang(null);
  };

  const fetchBaseData = async (authToken: string) => {
    setIsConnecting(true);
    setError('');
    setProgressMsg('Connecting to Google...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/data`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error('Failed to fetch data');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('Streaming not supported');

      let jsonStr = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        jsonStr += decoder.decode(value, { stream: true });
        const lines = jsonStr.split('\n');
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          try {
            const data = JSON.parse(line);
            if (data.error) throw new Error(data.error);
            if (data.status === 'progress') {
              setProgressMsg(data.message);
            }
            if (data.status === 'complete') {
              const langs: Language[] = data.result.languages.map((l: string) => ({ code: l, name: l.toUpperCase() }));
              setLanguages(langs);
              if (langs.length > 0) setSelectedLang(langs[0]);
              setClusters(data.result.clusters);
              setGscData(data.result.gsc);
            }
          } catch (e) {
            console.error("Error parsing chunk", e);
          }
        }
        jsonStr = lines[lines.length - 1];
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sync.');
    } finally {
      setIsConnecting(false);
    }
  };

  const runFullScan = async () => {
    if (!selectedLang) return;
    setIsLoading(true);
    setError('');
    setProgress(0);
    setProgressMsg('Initializing scan...');
    setScanResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/scan_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_lang: selectedLang.code,
          clusters: clusters
        })
      });

      if (!response.ok) throw new Error('Scan failed to start.');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) throw new Error('Streaming not supported');

      let jsonStr = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        jsonStr += decoder.decode(value, { stream: true });
        const lines = jsonStr.split('\n');
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          try {
            const data = JSON.parse(line);
            if (data.error) throw new Error(data.error);
            if (data.progress) setProgress(data.progress);
            if (data.message) setProgressMsg(data.message);
            if (data.result) setScanResults(data.result);
          } catch (e) {
            console.error("Error parsing scan chunk", e);
          }
        }
        jsonStr = lines[lines.length - 1];
      }
    } catch (err: any) {
      setError(err.message || 'Scan failed.');
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  };

  const runAisoScan = async () => {
    if (!aisoUrl) return;
    setIsAisoLoading(true);
    setError('');
    
    try {
      const url = new URL(`${API_BASE_URL}/api/analyze_aiso`);
      url.searchParams.append('url', aisoUrl);
      if (aisoKeyword) url.searchParams.append('keyword', aisoKeyword);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to analyze page.');
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setAisoResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAisoLoading(false);
    }
  };

  const getFilteredData = () => {
    if (!selectedLang) return { missing: [], optimizations: [], linking: [], brokenLinks: [], redirects: [], inlinks: [] };

    // Missing Localized Pages
    const missing = clusters
      .filter(c => c.en && !c[selectedLang?.code])
      .map((c, i) => ({
        id: `missing-${i}`,
        enUrl: c.en,
        globalImpressions: gscData[c.en]?.impressions || 0,
        topKeyword: gscData[c.en]?.topKeyword || 'N/A',
        action: 'Translate'
      }))
      .sort((a, b) => b.globalImpressions - a.globalImpressions);

    // GSC Optimizations
    const optimizations = clusters
      .filter(c => c.en && c[selectedLang?.code])
      .map((c, i) => {
        const localUrl = c[selectedLang?.code];
        const localData = gscData[localUrl] || { impressions: 0, topKeyword: 'N/A' };
        return {
          id: `opt-${i}`,
          enUrl: c.en,
          localizedUrls: c,
          localImpressions: { [selectedLang?.code]: localData.impressions },
          localTopKeyword: { [selectedLang?.code]: localData.topKeyword },
          recommendedAction: localData.impressions > 0 ? 'Expand Content' : 'Analyze'
        };
      })
      .sort((a, b) => (b.localImpressions[selectedLang?.code] || 0) - (a.localImpressions[selectedLang?.code] || 0));

    let linking: any[] = [];
    let brokenLinks: any[] = [];
    let redirects: any[] = [];
    let inlinks: any[] = [];

    if (scanResults) {
      // Internal Link Opportunities
      linking = scanResults.opportunities.map((opp: any, i: number) => ({
        id: `link-${i}`,
        enUrl: opp.enLink,
        localizedUrls: { [selectedLang?.code]: opp.i18nLink },
        sourceUrl: opp.source,
        linksToEn: 1 
      }));

      // Broken Links
      const brokenMap = new Map();
      scanResults.brokenLinks.forEach((bl: any) => {
        if (!brokenMap.has(bl.brokenLink)) {
          brokenMap.set(bl.brokenLink, {
            id: `broken-${bl.brokenLink}`,
            enUrl: bl.brokenLink,
            localizedUrls: { [selectedLang?.code]: bl.source },
            brokenLinksCount: 0
          });
        }
        brokenMap.get(bl.brokenLink).brokenLinksCount += 1;
      });
      brokenLinks = Array.from(brokenMap.values());

      redirects = scanResults.redirects || [];
      inlinks = scanResults.inlinks || [];
    }

    return { missing, optimizations, linking, brokenLinks, redirects, inlinks };
  };

  const filteredData = getFilteredData();

  // Pagination Logic
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  const paginatedMissing = filteredData.missing.slice(startIndex, endIndex);
  const paginatedOptimizations = filteredData.optimizations.slice(startIndex, endIndex);
  const paginatedRedirects = filteredData.redirects.slice(startIndex, endIndex);
  const paginatedBrokenLinks = filteredData.brokenLinks.slice(startIndex, endIndex);
  const paginatedLinking = filteredData.linking.slice(startIndex, endIndex);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="p-8 text-center bg-gradient-to-br from-indigo-600 to-blue-700">
            <Globe2 className="w-16 h-16 text-white mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">i18n SEO Analyzer</h1>
            <p className="text-indigo-100">Automate your international AI & SEO strategy.</p>
          </div>
          <div className="p-8 text-center">
            <p className="text-slate-600 mb-8">Connect your Google Search Console to securely import your sitemaps and search data.</p>
            <button 
              onClick={handleLogin}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-5 h-5" />
              Connect Search Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-white mb-2">
            <Globe2 className="w-8 h-8 text-indigo-400" />
            <span className="text-xl font-bold">i18n SEO</span>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-4 mb-2">Connected Project</p>
          <div className="bg-slate-800 rounded-lg p-2 text-sm text-slate-300 flex items-center justify-between">
            <span className="truncate">lucid.co</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">AI & Content Tools</div>
          <button 
            onClick={() => { setActiveTab('llm'); setCurrentPage(1); }}
            className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'llm' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <BrainCircuit className="w-5 h-5" />
            LLM Optimizer
          </button>
          <button 
            onClick={() => { setActiveTab('optimizations'); setCurrentPage(1); }}
            className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'optimizations' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Activity className="w-5 h-5" />
            Keyword Analysis
          </button>
          <button 
            onClick={() => { setActiveTab('missing'); setCurrentPage(1); }}
            className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'missing' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <FileText className="w-5 h-5" />
            Content Gaps
          </button>

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Technical SEO</div>
          <button 
            onClick={() => { setActiveTab('linking'); setCurrentPage(1); }}
            className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'linking' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LinkIcon className="w-5 h-5" />
            Link Updates
          </button>
          <button 
            onClick={() => { setActiveTab('broken'); setCurrentPage(1); }}
            className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'broken' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <ShieldAlert className="w-5 h-5" />
            404 Finder
          </button>
          <button 
            onClick={() => { setActiveTab('redirects'); setCurrentPage(1); }}
            className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'redirects' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <ArrowRight className="w-5 h-5" />
            Redirect Chains
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-full px-2 py-2">
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Disconnect</span>
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold text-slate-800 capitalize flex items-center gap-2">
              {getTabTitle()}
            </h2>
            
            {/* Language Selector */}
            {activeTab !== 'llm' && languages.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 border border-slate-200">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLang(lang)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      selectedLang?.code === lang.code
                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Scan Actions */}
          {activeTab !== 'llm' && (
            <button 
              onClick={runFullScan}
              disabled={isLoading || isConnecting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm
                ${(isLoading || isConnecting) 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow'}`}
            >
              {isLoading || isConnecting ? (
                <RefreshCcw className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isLoading || isConnecting ? 'Processing...' : 'Run Deep Scan'}
            </button>
          )}
        </header>

        {/* Sync Progress Status Overlay */}
        {(isLoading || isConnecting) && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <RefreshCcw className="w-5 h-5 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-indigo-800">{progressMsg}</span>
            </div>
            {progress > 0 && (
              <div className="flex items-center gap-3 w-64">
                <div className="flex-1 bg-indigo-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-600 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-semibold text-indigo-700">{progress}%</span>
              </div>
            )}
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-100 px-8 py-3 flex items-center gap-3 shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-800 font-medium">{error}</span>
          </div>
        )}

        {/* View Details Area */}
        <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Tab 1: AI Content Optimization (LLM) */}
            {activeTab === 'llm' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Optimize for AI Answer Engines</h3>
                  <p className="text-slate-600 mb-6 max-w-2xl text-sm">
                    Analyze any URL to see how easily AI models (like ChatGPT, Perplexity, or Google AI Overviews) can extract and cite your information.
                  </p>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        placeholder="https://lucid.co/your-page"
                        value={aisoUrl}
                        onChange={(e) => setAisoUrl(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div className="w-64">
                      <input 
                        type="text" 
                        placeholder="Target Keyword (Optional)"
                        value={aisoKeyword}
                        onChange={(e) => setAisoKeyword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={runAisoScan}
                      disabled={isAisoLoading || !aisoUrl}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-8 py-3 rounded-xl transition-all shadow-sm flex items-center gap-2"
                    >
                      {isAisoLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                      Analyze
                    </button>
                  </div>
                </div>

                {aisoResult && (
                  <div className="p-8 bg-slate-50">
                    <div className="flex items-center gap-8 mb-8">
                      <div className="relative w-32 h-32 flex items-center justify-center bg-white rounded-full shadow-sm border-8 border-indigo-100">
                        <div className={`text-4xl font-black ${aisoResult.score >= 80 ? 'text-emerald-500' : aisoResult.score >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                          {aisoResult.score}
                        </div>
                        <div className="absolute -bottom-2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                          AISO Score
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-800 mb-1">Extraction Readiness</h4>
                        <p className="text-slate-500 max-w-xl">
                          Scores above 80 indicate your page uses proper semantic structure, structured data, and high information density—making it an ideal "Cite-Magnet" for LLMs.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {aisoResult.recommendations?.map((rec: any, idx: number) => (
                        <div key={idx} className={`p-5 rounded-xl border flex gap-4 ${rec.type === 'success' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                          <div className="mt-0.5">
                            {rec.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <AlertCircle className="w-6 h-6 text-amber-500" />}
                          </div>
                          <div>
                            <h5 className={`font-bold mb-1 ${rec.type === 'success' ? 'text-emerald-900' : 'text-amber-900'}`}>{rec.title}</h5>
                            <p className={rec.type === 'success' ? 'text-emerald-700' : 'text-amber-800'}>{rec.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Keyword Performance Analysis */}
            {activeTab === 'optimizations' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-500" />
                    Local Performance
                  </h3>
                  <span className="text-sm text-slate-500">Showing {startIndex + 1}-{Math.min(endIndex, filteredData.optimizations.length)} of {filteredData.optimizations.length} pages</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Localized URL</th>
                        <th className="p-4 font-semibold">Local Impressions (30d)</th>
                        <th className="p-4 font-semibold">Top Ranked Keyword</th>
                        <th className="p-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedOptimizations.length > 0 ? paginatedOptimizations.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 max-w-xs truncate">
                             <a href={page.localizedUrls?.[selectedLang?.code || ''] || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
                              {(page.localizedUrls?.[selectedLang?.code || ''] || page.enUrl).replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          </td>
                          <td className="p-4">
                            <span className="font-semibold text-slate-700">{page.localImpressions?.[selectedLang?.code || '']?.toLocaleString() || 0}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-medium text-indigo-700 bg-indigo-50/50 px-2 py-1 rounded">
                              "{page.localTopKeyword?.[selectedLang?.code || ''] || 'N/A'}"
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {page.recommendedAction || 'Analyze'}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No data available for this language.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Missing Localized Content (Content Gaps) */}
            {activeTab === 'missing' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    Missing Translations
                  </h3>
                  <span className="text-sm text-slate-500">Showing {startIndex + 1}-{Math.min(endIndex, filteredData.missing.length)} of {filteredData.missing.length} pages</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">English URL</th>
                        <th className="p-4 font-semibold">Global Impressions (30d)</th>
                        <th className="p-4 font-semibold">Top English Keyword</th>
                        <th className="p-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedMissing.length > 0 ? paginatedMissing.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-slate-800 max-w-xs truncate">
                            {page.enUrl.replace('https://lucid.co', '')}
                          </td>
                          <td className="p-4 font-semibold text-slate-700">
                            {page.globalImpressions.toLocaleString()}
                          </td>
                          <td className="p-4 text-slate-500 italic">
                            {page.topKeyword}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              Needs Translation
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">All high-value pages are translated!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 4: Localized Link Opportunities */}
            {activeTab === 'linking' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-indigo-500" />
                    Internal Link Opportunities
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Localized pages that are currently linking to the English version of another page, instead of the localized version.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Source Page (Where the link is)</th>
                        <th className="p-4 font-semibold">Update Needed</th>
                        <th className="p-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLinking.length > 0 ? paginatedLinking.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 max-w-sm">
                            <a href={page.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              {page.sourceUrl.replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 text-sm">
                              <span className="text-red-500 line-through decoration-red-300">{page.enUrl.replace('https://lucid.co', '')}</span>
                              <ChevronRight className="w-4 h-4 text-slate-400 mx-auto rotate-90 my-1" />
                              <span className="text-emerald-600 font-medium">{page.localizedUrls?.[selectedLang?.code || '']?.replace('https://lucid.co', '')}</span>
                            </div>
                          </td>
                          <td className="p-4">
                             <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                               Update Link
                             </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-500">
                            {!scanResults ? 'Run a Deep Scan to analyze internal links.' : 'No link updates required!'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 5: Broken Localized Links (404s) */}
            {activeTab === 'broken' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    Broken Internal Links (404s)
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Links on your site that lead to a 404 page.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Broken Link URL</th>
                        <th className="p-4 font-semibold">Found On (Source)</th>
                        <th className="p-4 font-semibold">Occurrences</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedBrokenLinks.length > 0 ? paginatedBrokenLinks.map((page) => (
                        <tr key={page.id} className="hover:bg-red-50/50 transition-colors">
                          <td className="p-4 font-medium text-red-600 truncate max-w-sm">
                            {page.enUrl}
                          </td>
                          <td className="p-4 truncate max-w-sm text-slate-500">
                            {page.localizedUrls?.[selectedLang?.code || '']}
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{page.brokenLinksCount}</span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-500">
                             {!scanResults ? 'Run a Deep Scan to search for 404s.' : 'No broken links found!'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 6: Redirect Tracing */}
            {activeTab === 'redirects' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-amber-500" />
                    Redirects
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Internal links pointing to URLs that redirect somewhere else.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Original URL Clicked</th>
                        <th className="p-4 font-semibold">Final Destination</th>
                        <th className="p-4 font-semibold">Status Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedRedirects.length > 0 ? paginatedRedirects.map((redirect: any, idx: number) => (
                        <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 text-slate-500 line-through decoration-slate-300 max-w-xs truncate">
                            {redirect.originalUrl}
                          </td>
                          <td className="p-4 font-medium text-emerald-600 max-w-xs truncate">
                            {redirect.destinationUrl}
                          </td>
                          <td className="p-4">
                             <span className="bg-amber-100 text-amber-800 font-mono text-xs px-2 py-1 rounded">
                               {redirect.statusCode}
                             </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-slate-500">
                             {!scanResults ? 'Run a Deep Scan to trace redirects.' : 'No internal redirects found!'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {activeTab !== 'llm' && getActiveTabArray().length > itemsPerPage && (
               <div className="flex justify-center mt-6">
                 <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                   <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:bg-slate-100 border-r border-slate-200"
                   >
                     Previous
                   </button>
                   <span className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50">
                     Page {currentPage} of {Math.ceil(getActiveTabArray().length / itemsPerPage)}
                   </span>
                   <button 
                     onClick={() => setCurrentPage(p => p + 1)}
                     disabled={currentPage === Math.ceil(getActiveTabArray().length / itemsPerPage)}
                     className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:bg-slate-100 border-l border-slate-200"
                   >
                     Next
                   </button>
                 </div>
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}