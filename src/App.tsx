import { useState, useEffect, Fragment } from 'react';
import { 
  AlertCircle, CheckCircle2, ChevronRight, ChevronDown, ExternalLink, 
  Globe2, Link as LinkIcon, Search, LogOut, 
  FileText, BrainCircuit, Activity, ArrowRight,
  ShieldAlert, RefreshCcw, Network, Clock, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

const API_BASE_URL = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8000'
  : 'https://i18n-seo-analyzer-3d2678f53f5d.herokuapp.com'; // Use your real Heroku URL here!

interface Language {
  code: string;
  name: string;
}

export default function App() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Data State
  const [languages, setLanguages] = useState<Language[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [lastmods, setLastmods] = useState<Record<string, string>>({});
  const [gscData, setGscData] = useState<any>({});
  
  // Database Caching Maps
  const [scanResultsMap, setScanResultsMap] = useState<Record<string, any>>({});
  const [lastScanDatesMap, setLastScanDatesMap] = useState<Record<string, string>>({});

  // UI State
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [activeTab, setActiveTab] = useState('llm');
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  
  // Pagination & Filter State
  const [currentPage, setCurrentPage] = useState(1);
  const [urlFilter, setUrlFilter] = useState('');
  const [minImpressions, setMinImpressions] = useState<number | ''>('');
  const itemsPerPage = 100;

  // AISO State
  const [aisoUrl, setAisoUrl] = useState('');
  const [aisoResult, setAisoResult] = useState<any>(null);
  const [isAisoLoading, setIsAisoLoading] = useState(false);

  // On-Page State
  const [customKeywords, setCustomKeywords] = useState<Record<string, string>>({});
  const [onPageResults, setOnPageResults] = useState<Record<string, any>>({});
  const [analyzingRows, setAnalyzingRows] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const scanResults = selectedLang ? scanResultsMap[selectedLang.code] : null;
  const lastScanDateStr = selectedLang ? lastScanDatesMap[selectedLang.code] : null;
  const lastScanDate = lastScanDateStr ? new Date(lastScanDateStr) : null;

  const getActiveTabArrayRaw = (): any[] => {
    switch (activeTab) {
      case 'optimizations': return filteredData.optimizations;
      case 'missing': return filteredData.missing;
      case 'freshness': return filteredData.freshness;
      case 'linking': return filteredData.linking;
      case 'broken': return filteredData.brokenLinks;
      case 'redirects': return filteredData.redirects;
      case 'inlinks': return filteredData.inlinks;
      default: return [];
    }
  };

  const getActiveTabArray = (): any[] => {
    let data = [...getActiveTabArrayRaw()];

    // Apply URL Filter
    if (urlFilter.trim() !== '') {
      const lowerFilter = urlFilter.toLowerCase();
      data = data.filter(item => {
        const urls = [
          item.url, 
          item.enUrl, 
          item.originalLink, 
          item.destinationUrl, 
          item.sourceUrl,
          item.brokenLink,
          ...(item.localizedUrls ? Object.values(item.localizedUrls) : [])
        ].filter(Boolean).map(u => String(u).toLowerCase());
        
        return urls.some(u => u.includes(lowerFilter));
      });
    }

    // Apply Impressions Filter
    if (minImpressions !== '') {
      const minImp = Number(minImpressions);
      data = data.filter(item => {
        let imp = undefined;
        if (item.globalImpressions !== undefined) imp = item.globalImpressions;
        else if (item.localImpressions && selectedLang) imp = item.localImpressions[selectedLang.code];
        else if (item.impressions !== undefined) imp = item.impressions;
        
        if (imp !== undefined) {
          return imp >= minImp;
        }
        return true;
      });
    }

    // Sorting
    if (sortConfig) {
      data.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'localImpressions') {
          aVal = a.localImpressions?.[selectedLang?.code || ''] || 0;
          bVal = b.localImpressions?.[selectedLang?.code || ''] || 0;
        } else if (sortConfig.key === 'lastMod') {
          aVal = new Date(a.lastMod || (sortConfig.direction === 'asc' ? '9999-12-31' : '1970-01-01')).getTime();
          bVal = new Date(b.lastMod || (sortConfig.direction === 'asc' ? '9999-12-31' : '1970-01-01')).getTime();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  };

  const getTabTitle = (): string => {
    switch (activeTab) {
      case 'llm': return 'LLM Content Optimizer';
      case 'optimizations': return 'Keyword Analysis';
      case 'missing': return 'Missing Translations';
      case 'freshness': return 'Content Freshness';
      case 'linking': return 'Link Updates';
      case 'broken': return '404 Finder';
      case 'redirects': return 'Redirects';
      case 'inlinks': return 'Internal Links';
      default: return activeTab;
    }
  };

  const isEnglishUrl = (url: string) => {
    if (!url) return false;
    try {
      const path = new URL(url).pathname;
      return !languages.some(lang => path.startsWith(`/${lang.code}/`) || path === `/${lang.code}`);
    } catch {
      return true;
    }
  };

  const isOtherLangUrl = (url: string) => {
    if (!selectedLang || !url) return false;
    try {
      const path = new URL(url).pathname;
      return languages.some(lang => 
        lang.code !== selectedLang.code && 
        (path.startsWith(`/${lang.code}/`) || path === `/${lang.code}`)
      );
    } catch {
      return false;
    }
  };

  useEffect(() => {
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
    setScanResultsMap({});
    setLastScanDatesMap({});
    setSelectedLang(null);
  };

  const fetchBaseData = async (authToken: string, forceRefresh: boolean = false) => {
    setIsConnecting(true);
    setError('');
    setProgressMsg('Fetching from database...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/data?force_refresh=${forceRefresh}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
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
              if (langs.length > 0 && !selectedLang) setSelectedLang(langs[0]);
              setClusters(data.result.clusters);
              setLastmods(data.result.lastmods || {});
              setGscData(data.result.gsc);
              
              if (data.cached_scans) {
                setScanResultsMap(data.cached_scans);
                setLastScanDatesMap(data.cached_dates);
              }
            }
          } catch (e: any) {
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
            if (data.result) {
              const currentDate = new Date().toISOString();
              
              // Persist seamlessly into maps
              setScanResultsMap(prev => ({ ...prev, [selectedLang.code]: data.result }));
              setLastScanDatesMap(prev => ({ ...prev, [selectedLang.code]: currentDate }));
            }
          } catch (e: any) {
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

  const runOnPageAnalysis = async (pageId: string, url: string, defaultKeyword: string) => {
    const keywordToAnalyze = customKeywords[pageId] || defaultKeyword;
    if (!keywordToAnalyze || keywordToAnalyze === 'N/A') return;

    setAnalyzingRows(prev => ({ ...prev, [pageId]: true }));
    try {
      const targetUrl = new URL(`${API_BASE_URL}/api/analyze_onpage`);
      targetUrl.searchParams.append('url', url);
      targetUrl.searchParams.append('keyword', keywordToAnalyze);

      const response = await fetch(targetUrl.toString());
      if (!response.ok) throw new Error('Analysis failed');
      
      const data = await response.json();
      setOnPageResults(prev => ({ ...prev, [pageId]: data }));
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzingRows(prev => ({ ...prev, [pageId]: false }));
    }
  };

  const getFilteredData = () => {
    if (!selectedLang) return { missing: [], freshness: [], optimizations: [], linking: [], brokenLinks: [], redirects: [], inlinks: [] };

    // 1. Create a fast "Truth Map" for resolving redirects instantly
    const knownRedirectsMap = new Map();
    (scanResults?.redirects || []).forEach((r: any) => {
      knownRedirectsMap.set(r.originalUrl, r.destinationUrl);
    });

    const resolveRedirect = (url: string) => {
      let currentUrl = url;
      let iterations = 0;
      // Safely follow up to 5 redirect hops to find the true destination
      while (iterations < 5 && knownRedirectsMap.has(currentUrl)) {
        currentUrl = knownRedirectsMap.get(currentUrl);
        iterations++;
      }
      return currentUrl;
    };

    const isRedirectSource = (url: string) => knownRedirectsMap.has(url);

    // Content Freshness
    const freshness = clusters
      .filter(c => c[selectedLang?.code] && !isRedirectSource(c[selectedLang?.code]))
      .map((c, i) => {
        const localUrl = c[selectedLang?.code];
        const lastModStr = lastmods[localUrl] || lastmods[c.en] || null;
        
        let isStale = false;
        let daysOld = 0;
        if (lastModStr) {
            const diffTime = Math.abs(new Date().getTime() - new Date(lastModStr).getTime());
            daysOld = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isStale = daysOld > 90;
        } else {
            isStale = true;
        }
        
        return {
            id: `fresh-${i}`,
            url: localUrl,
            lastMod: lastModStr,
            daysOld,
            isStale,
            impressions: gscData[localUrl]?.impressions || 0
        };
      });

    // Missing Translations
    const missing = clusters
      .filter(c => c.en && isEnglishUrl(c.en) && !c[selectedLang?.code] && !isRedirectSource(c.en))
      .map((c, i) => ({
        id: `missing-${i}`,
        enUrl: c.en,
        globalImpressions: gscData[c.en]?.impressions || 0,
        topKeyword: gscData[c.en]?.topKeyword || 'N/A',
        action: 'Translate'
      }));

    // GSC Optimizations
    const optimizations = clusters
      .filter(c => c[selectedLang?.code] && !isRedirectSource(c[selectedLang?.code]))
      .map((c, i) => {
        const localUrl = c[selectedLang?.code];
        const enUrlFallback = c.en || localUrl; // Use local URL as fallback if no English version exists
        const localData = gscData[localUrl] || { impressions: 0, topKeyword: 'N/A' };
        return {
          id: `opt-${i}`,
          enUrl: enUrlFallback,
          localizedUrls: c,
          localImpressions: { [selectedLang?.code]: localData.impressions },
          localTopKeyword: { [selectedLang?.code]: localData.topKeyword },
          recommendedAction: localData.impressions > 0 ? 'Expand Content' : 'Analyze'
        };
      });

    let linking: any[] = [];
    let brokenLinks: any[] = [];
    let redirects: any[] = [];
    let inlinks: any[] = [];

    if (scanResults) {
      const oppsMap = new Map();
      (scanResults.opportunities || []).forEach((opp: any) => {
        if (!isEnglishUrl(opp.enLink) || isOtherLangUrl(opp.source)) return;

        const resolvedEnLink = resolveRedirect(opp.enLink);
        const resolvedOriginal = resolveRedirect(opp.originalLink);
        
        // Find the cluster using the final resolved destination URL
        const targetCluster = clusters.find(c => c.en === resolvedEnLink || c.en === opp.enLink);
        const targetI18nLink = targetCluster?.[selectedLang?.code || ''] || opp.i18nLink;

        // CRITICAL: If the original link already redirects to the correct localized target, 
        // it's not a missing localization opportunity, it's just a standard redirect. Skip it!
        if (resolvedOriginal === targetI18nLink) return;

        const key = `${opp.source}-${opp.originalLink}`;
        if (!oppsMap.has(key)) {
          oppsMap.set(key, {
            enUrl: resolvedEnLink,
            originalLink: opp.originalLink,
            localizedUrls: { [selectedLang?.code || '']: targetI18nLink },
            sourceUrl: opp.source,
            linksToEn: 1
          });
        }
      });
      linking = Array.from(oppsMap.values()).map((opp, i) => ({ ...opp, id: `link-${i}` }));

      const brokenMap = new Map();
      (scanResults.brokenLinks || []).forEach((bl: any) => {
        if (isOtherLangUrl(bl.brokenLink) || isOtherLangUrl(bl.source)) return;
        
        const resolvedBroken = resolveRedirect(bl.brokenLink);

        if (!brokenMap.has(resolvedBroken)) {
          brokenMap.set(resolvedBroken, {
            enUrl: resolvedBroken,
            sources: [],
            brokenLinksCount: 0
          });
        }
        const item = brokenMap.get(resolvedBroken);
        if (!item.sources.includes(bl.source) && bl.source !== "Sitemap Check") {
          item.sources.push(bl.source);
        }
        item.brokenLinksCount += 1;
      });
      brokenLinks = Array.from(brokenMap.values()).map((bl, i) => ({ ...bl, id: `broken-${i}` }));

      redirects = (scanResults.redirects || [])
        .filter((r: any) => !isOtherLangUrl(r.originalUrl) && r.sources && r.sources.length > 0)
        .map((r: any, i: number) => ({
          ...r,
          id: `redirect-${i}`
        }));
      
      const mergedInlinks = new Map();
      (scanResults.inlinks || []).forEach((link: any) => {
          if (isOtherLangUrl(link.url)) return;
          
          // Fast-forward any inlinks pointing to a redirect over to the final destination
          const resolvedUrl = resolveRedirect(link.url);
          
          if (!mergedInlinks.has(resolvedUrl)) {
              mergedInlinks.set(resolvedUrl, {
                  url: resolvedUrl,
                  inlinks: 0,
                  uniqueInlinks: 0,
                  sources: [],
                  seenAnchors: new Set()
              });
          }
          
          const merged = mergedInlinks.get(resolvedUrl);
          merged.inlinks += link.inlinks;
          
          (link.sources || []).forEach((src: any) => {
              merged.sources.push(src);
              if (src.anchor && !merged.seenAnchors.has(src.anchor)) {
                  merged.seenAnchors.add(src.anchor);
                  merged.uniqueInlinks += 1;
              }
          });
      });
      inlinks = Array.from(mergedInlinks.values()).map((link, i) => ({ ...link, id: `inlink-${i}` }));
    }

    return { missing, freshness, optimizations, linking, brokenLinks, redirects, inlinks };
  };

  const filteredData = getFilteredData();
  const activeTabArray = getActiveTabArray();

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = activeTabArray.slice(startIndex, endIndex);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
        direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
    <th 
        className="p-4 font-semibold cursor-pointer hover:bg-slate-200 transition-colors select-none group"
        onClick={() => handleSort(sortKey)}
    >
        <div className="flex items-center gap-1">
            {label}
            {sortConfig?.key === sortKey ? (
                sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
            ) : (
                <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />
            )}
        </div>
    </th>
  );

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
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-white mb-2">
            <Globe2 className="w-8 h-8 text-indigo-400" />
            <span className="text-xl font-bold">i18n SEO</span>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-4 mb-2">Connected Project</p>
          <div className="bg-slate-800 rounded-lg p-2 text-sm text-slate-300 flex items-center justify-between">
            <span className="truncate flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              lucid.co
            </span>
            <button 
              onClick={() => fetchBaseData(localStorage.getItem('gsc_token') || '', true)}
              disabled={isConnecting}
              title="Force Refresh Sitemap & GSC Data"
              className="hover:bg-slate-700 hover:text-white p-1.5 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">AI & Content Tools</div>
          <button onClick={() => { setActiveTab('llm'); setCurrentPage(1); setSortConfig(null); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'llm' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <BrainCircuit className="w-5 h-5" /> LLM Optimizer
          </button>
          <button onClick={() => { setActiveTab('optimizations'); setCurrentPage(1); setSortConfig({key: 'localImpressions', direction: 'desc'}); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'optimizations' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Activity className="w-5 h-5" /> Keyword Analysis
          </button>
          <button onClick={() => { setActiveTab('freshness'); setCurrentPage(1); setSortConfig({key: 'impressions', direction: 'desc'}); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'freshness' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Clock className="w-5 h-5" /> Content Freshness
          </button>
          <button onClick={() => { setActiveTab('missing'); setCurrentPage(1); setSortConfig({key: 'globalImpressions', direction: 'desc'}); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'missing' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <FileText className="w-5 h-5" /> Missing Translations
          </button>

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Technical SEO</div>
          <button onClick={() => { setActiveTab('inlinks'); setCurrentPage(1); setSortConfig({key: 'inlinks', direction: 'asc'}); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'inlinks' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Network className="w-5 h-5" /> Internal Links
          </button>
          <button onClick={() => { setActiveTab('linking'); setCurrentPage(1); setSortConfig(null); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'linking' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <LinkIcon className="w-5 h-5" /> Link Updates
          </button>
          <button onClick={() => { setActiveTab('broken'); setCurrentPage(1); setSortConfig({key: 'brokenLinksCount', direction: 'desc'}); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'broken' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <ShieldAlert className="w-5 h-5" /> 404 Finder
          </button>
          <button onClick={() => { setActiveTab('redirects'); setCurrentPage(1); setSortConfig(null); }} className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'redirects' ? 'bg-indigo-500/20 text-indigo-400 font-medium' : 'hover:bg-slate-800 hover:text-white'}`}>
            <ArrowRight className="w-5 h-5" /> Redirects
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors w-full px-2 py-2">
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Disconnect</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold text-slate-800 capitalize flex items-center gap-2">
              {getTabTitle()}
            </h2>
          </div>
            
          {activeTab !== 'llm' && languages.length > 0 && (
            <div className="flex items-center gap-4">
              {scanResults && ['linking', 'broken', 'redirects', 'inlinks'].includes(activeTab) && (
                <div className="text-right mr-2 hidden lg:block">
                  <p className="text-xs font-medium text-slate-500 flex items-center justify-end gap-1">
                    <Clock className="w-3.5 h-3.5" /> Last scan {lastScanDate ? lastScanDate.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Click "Run Deep Scan" to refresh database</p>
                </div>
              )}
              <div className="relative group">
                <select
                  value={selectedLang?.code || ''}
                  onChange={(e) => {
                    const lang = languages.find(l => l.code === e.target.value);
                    if (lang) {
                      setSelectedLang(lang);
                      setCurrentPage(1);
                    }
                  }}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-4 pr-10 rounded-xl font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all cursor-pointer shadow-sm group-hover:bg-slate-100"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>Target Language: {lang.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-colors" />
              </div>
              <button 
                onClick={runFullScan} 
                disabled={isLoading}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-medium py-2 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm"
              >
                {isLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Run Deep Scan
              </button>
            </div>
          )}
        </header>

        {activeTab !== 'llm' && (
          <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between shrink-0 z-0">
            <div className="flex items-center gap-6 flex-1">
              <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
                <Search className="w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter by URL..." 
                  value={urlFilter}
                  onChange={(e) => { setUrlFilter(e.target.value); setCurrentPage(1); }}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder-slate-400"
                />
              </div>
              <div className="w-px h-6 bg-slate-200"></div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 font-medium">Min. Impressions:</span>
                <input 
                  type="number" 
                  min="0"
                  placeholder="0"
                  value={minImpressions}
                  onChange={(e) => { setMinImpressions(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(1); }}
                  className="w-24 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {}
        {(isLoading || isConnecting) && (
          <div className="bg-indigo-50 border-b border-indigo-100 px-8 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <RefreshCcw className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-sm font-medium text-indigo-800">{progressMsg}</span>
            </div>
            {isLoading && (
              <div className="flex items-center gap-3 w-64">
                <div className="flex-1 h-2 bg-indigo-200 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs font-semibold text-indigo-700">{progress}%</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-b border-red-100 px-8 py-3 flex items-center gap-3 shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-800 font-medium">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
          <div className="max-w-6xl mx-auto space-y-6">

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
                          <div className="flex-1">
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

            {}
            {activeTab === 'optimizations' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-500" /> Local Performance
                  </h3>
                  <span className="text-sm text-slate-500">Showing {startIndex + 1}-{Math.min(endIndex, filteredData.optimizations.length)} of {filteredData.optimizations.length} pages</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Localized URL</th>
                        <SortableHeader label="Local Impressions (30d)" sortKey="localImpressions" />
                        <th className="p-4 font-semibold">Target Keyword</th>
                        <th className="p-4 font-semibold">On-Page Analysis</th>
                        <th className="p-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.length > 0 ? paginatedData.map((page) => {
                        const localUrl = page.localizedUrls?.[selectedLang?.code || ''] || page.enUrl;
                        const defaultKw = page.localTopKeyword?.[selectedLang?.code || ''] || 'N/A';
                        const currentKw = customKeywords[page.id] !== undefined ? customKeywords[page.id] : defaultKw;
                        const analysis = onPageResults[page.id];
                        const isAnalyzing = analyzingRows[page.id];

                        return (
                          <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 max-w-xs truncate">
                               <a href={localUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
                                {localUrl.replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3 inline" />
                              </a>
                            </td>
                            <td className="p-4">
                              <span className="font-semibold text-slate-700">{page.localImpressions?.[selectedLang?.code || '']?.toLocaleString() || 0}</span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-2">
                                <input 
                                  type="text" 
                                  value={currentKw === 'N/A' ? '' : currentKw}
                                  onChange={(e) => setCustomKeywords(prev => ({ ...prev, [page.id]: e.target.value }))}
                                  placeholder="Enter keyword..."
                                  className="px-3 py-1.5 text-sm rounded border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none w-48"
                                />
                                {defaultKw !== 'N/A' && currentKw !== defaultKw && (
                                  <span className="text-[10px] text-slate-400">GSC Top: {defaultKw}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              {analysis ? (
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className={`px-2 py-1 rounded border ${analysis.inTitle ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>Title: {analysis.inTitle ? 'Yes' : 'No'}</span>
                                  <span className={`px-2 py-1 rounded border ${analysis.inH1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>H1: {analysis.inH1 ? 'Yes' : 'No'}</span>
                                  <span className={`px-2 py-1 rounded border ${analysis.inH2 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>H2: {analysis.inH2 ? 'Yes' : 'No'}</span>
                                  <span className="px-2 py-1 rounded border bg-slate-50 text-slate-700 border-slate-200 font-mono">Matches: {analysis.wordCount}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Not analyzed</span>
                              )}
                            </td>
                            <td className="p-4">
                              <button 
                                onClick={() => runOnPageAnalysis(page.id, localUrl, defaultKw)}
                                disabled={isAnalyzing || (!currentKw || currentKw === 'N/A')}
                                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                              >
                                {isAnalyzing ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Analyze
                              </button>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">No data available for this language.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'freshness' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-500" /> Content Freshness Check
                  </h3>
                  <span className="text-sm text-slate-500">Showing {startIndex + 1}-{Math.min(endIndex, filteredData.freshness.length)} of {filteredData.freshness.length} pages</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">URL</th>
                        <SortableHeader label="Impressions (30d)" sortKey="impressions" />
                        <SortableHeader label="Last Updated" sortKey="lastMod" />
                        <SortableHeader label="Days Old" sortKey="daysOld" />
                        <th className="p-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.length > 0 ? paginatedData.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 max-w-sm truncate">
                             <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
                              {page.url.replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          </td>
                          <td className="p-4 font-semibold text-slate-700">{page.impressions?.toLocaleString() || 0}</td>
                          <td className="p-4 font-medium text-slate-800">{page.lastMod ? new Date(page.lastMod).toLocaleDateString() : 'Unknown'}</td>
                          <td className="p-4">
                            <span className={`font-bold ${page.isStale ? 'text-red-500' : 'text-emerald-600'}`}>
                              {page.lastMod ? `${page.daysOld} days` : 'N/A'}
                            </span>
                          </td>
                          <td className="p-4">
                             {page.isStale ? (
                               <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Update Content</span>
                             ) : (
                               <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Fresh</span>
                             )}
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-400">No content data available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'missing' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" /> Missing Translations
                  </h3>
                  <span className="text-sm text-slate-500">Showing {startIndex + 1}-{Math.min(endIndex, filteredData.missing.length)} of {filteredData.missing.length} pages</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">English URL</th>
                        <SortableHeader label="Global Impressions (30d)" sortKey="globalImpressions" />
                        <th className="p-4 font-semibold">Top English Keyword</th>
                        <th className="p-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.length > 0 ? paginatedData.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-medium text-slate-800 max-w-xs truncate">{page.enUrl.replace('https://lucid.co', '')}</td>
                          <td className="p-4 font-semibold text-slate-700">{page.globalImpressions.toLocaleString()}</td>
                          <td className="p-4 text-slate-500 italic">{page.topKeyword}</td>
                          <td className="p-4">
                            <span className="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Needs Translation</span>
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

            {activeTab === 'linking' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-indigo-500" /> Internal Link Opportunities
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
                      {paginatedData.length > 0 ? paginatedData.map((page) => (
                        <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 max-w-sm">
                            <a href={page.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              {page.sourceUrl.replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 text-sm">
                              <span className="text-red-500 line-through decoration-red-300">{page.originalLink.replace('https://lucid.co', '')}</span>
                              <ChevronRight className="w-4 h-4 text-slate-400 mx-auto rotate-90 my-1" />
                              <span className="text-emerald-600 font-medium">{page.localizedUrls?.[selectedLang?.code || '']?.replace('https://lucid.co', '')}</span>
                              
                              {page.originalLink !== page.enUrl && (
                                <span className="text-xs text-slate-400 mt-1 italic">
                                  (Redirects from: {page.originalLink.replace('https://lucid.co', '')})
                                </span>
                              )}
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

            {activeTab === 'broken' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-500" /> 404 Finder
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Internal links pointing to dead pages.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Broken URL</th>
                        <SortableHeader label="Occurrences" sortKey="brokenLinksCount" />
                        <th className="p-4 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.length > 0 ? paginatedData.map((link: any) => (
                        <Fragment key={link.id}>
                          <tr onClick={() => toggleRow(link.id)} className="transition-colors cursor-pointer hover:bg-slate-50">
                            <td className="p-4 font-medium text-slate-800 truncate max-w-sm flex items-center gap-2">
                              {expandedRows[link.id] ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                              <span className="truncate">{link.enUrl.replace('https://lucid.co', '')}</span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-red-500">{link.brokenLinksCount || 0}</span>
                                <span className="text-slate-500 text-xs">links returning 404</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                Fix 404
                              </span>
                            </td>
                          </tr>
                          {expandedRows[link.id] && link.sources && link.sources.length > 0 && (
                            <tr className="bg-slate-50">
                              <td colSpan={3} className="p-4 pl-12 border-t border-slate-100">
                                <div className="text-sm font-semibold text-slate-700 mb-3">Linked From:</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {link.sources.map((srcUrl: string, idx: number) => (
                                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-1.5">
                                      <div className="text-xs text-slate-500 truncate" title={srcUrl}>
                                        <a href={srcUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{srcUrl.replace('https://lucid.co', '')}</a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )) : (
                        <tr><td colSpan={3} className="p-8 text-center text-slate-500">No broken links found!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'inlinks' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Network className="w-5 h-5 text-indigo-500" /> Internal Links
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Discover pages with low internal linking. Pages with 0 inlinks are highlighted in red.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Destination URL</th>
                        <SortableHeader label="Total Inlinks" sortKey="inlinks" />
                        <SortableHeader label="Unique Anchors" sortKey="uniqueInlinks" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.length > 0 ? paginatedData.map((link: any) => (
                        <Fragment key={link.id}>
                          <tr onClick={() => toggleRow(link.id)} className={`transition-colors cursor-pointer ${link.inlinks === 0 ? 'bg-red-50/40 hover:bg-red-50/80' : 'hover:bg-slate-50'}`}>
                            <td className="p-4 font-medium text-slate-800 truncate max-w-sm flex items-center gap-2">
                              {expandedRows[link.id] ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <span className="truncate">{link.url.replace('https://lucid.co', '')}</span> <ExternalLink className="w-3 h-3 inline shrink-0" />
                              </a>
                            </td>
                            <td className="p-4">
                              <span className={`font-bold px-2 py-1 rounded border ${link.inlinks === 0 ? 'text-red-700 bg-red-100 border-red-200' : 'text-indigo-700 bg-indigo-50 border-indigo-100'}`}>
                                {link.inlinks}
                              </span>
                            </td>
                            <td className="p-4"><span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{link.uniqueInlinks}</span></td>
                          </tr>
                          {expandedRows[link.id] && link.sources && link.sources.length > 0 && (
                            <tr className="bg-slate-50">
                              <td colSpan={3} className="p-4 pl-12 border-t border-slate-100">
                                <div className="text-sm font-semibold text-slate-700 mb-3">Sources & Anchor Texts:</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {link.sources.map((src: any, idx: number) => (
                                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-1.5">
                                      <div className="text-xs text-slate-500 truncate" title={src.url}>
                                        <span className="font-semibold text-slate-400 mr-1">From:</span>
                                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{src.url.replace('https://lucid.co', '')}</a>
                                      </div>
                                      <div className="text-sm font-medium text-slate-800 bg-slate-50 px-2 py-1 rounded border border-slate-100">"{src.anchor}"</div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )) : (
                        <tr><td colSpan={3} className="p-8 text-center text-slate-500">No internal links found! Run a Deep Scan.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'redirects' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-indigo-500" /> Redirects Found
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Internal links pointing to pages that redirect.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-100 text-slate-500">
                      <tr>
                        <th className="p-4 font-semibold">Original Link (Found on Page)</th>
                        <th className="p-4 font-semibold">Final Destination</th>
                        <th className="p-4 font-semibold">Status Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedData.length > 0 ? paginatedData.map((link: any) => (
                        <Fragment key={link.id}>
                          <tr onClick={() => toggleRow(link.id)} className="transition-colors cursor-pointer hover:bg-slate-50">
                            <td className="p-4 max-w-sm truncate flex items-center gap-2">
                              {expandedRows[link.id] ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                              <span className="text-red-500 line-through decoration-red-300 truncate">{link.originalUrl.replace('https://lucid.co', '')}</span>
                            </td>
                            <td className="p-4 max-w-sm truncate">
                              <a href={link.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline flex items-center gap-1 font-medium">
                                {link.destinationUrl.replace('https://lucid.co', '')} <ExternalLink className="w-3 h-3 inline shrink-0" />
                              </a>
                            </td>
                            <td className="p-4">
                              <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                {link.statusCode} Redirect
                              </span>
                            </td>
                          </tr>
                          {expandedRows[link.id] && link.sources && link.sources.length > 0 && (
                            <tr className="bg-slate-50">
                              <td colSpan={3} className="p-4 pl-12 border-t border-slate-100">
                                <div className="text-sm font-semibold text-slate-700 mb-3">Linked From:</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {link.sources.map((srcUrl: string, idx: number) => (
                                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-1.5">
                                      <div className="text-xs text-slate-500 truncate" title={srcUrl}>
                                        <a href={srcUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{srcUrl.replace('https://lucid.co', '')}</a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )) : (
                        <tr><td colSpan={3} className="p-8 text-center text-slate-500">No redirects found!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination UI - Using cached activeTabArray for stability */}
            {activeTab !== 'llm' && activeTabArray.length > itemsPerPage && (
               <div className="flex justify-center mt-6 mb-8">
                 <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                   <button 
                     onClick={() => {
                         setCurrentPage(p => Math.max(1, p - 1));
                         document.querySelector('.overflow-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
                     }}
                     disabled={currentPage === 1}
                     className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:bg-slate-100 border-r border-slate-200 transition-colors"
                   >
                     Previous
                   </button>
                   <span className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50">
                     Page {currentPage} of {Math.ceil(activeTabArray.length / itemsPerPage)}
                   </span>
                   <button 
                     onClick={() => {
                         setCurrentPage(p => p + 1);
                         document.querySelector('.overflow-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
                     }}
                     disabled={currentPage === Math.ceil(activeTabArray.length / itemsPerPage)}
                     className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:bg-slate-100 border-l border-slate-200 transition-colors"
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