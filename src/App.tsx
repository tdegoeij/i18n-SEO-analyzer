import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, AlertTriangle, Zap, Link as LinkIcon, RefreshCw, 
  ChevronDown, ChevronRight, XCircle, Search, ExternalLink,
  ArrowUpDown, ArrowUp, ArrowDown, Edit3, ArrowRightLeft, LogOut,
  Download
} from 'lucide-react';

export default function App() {
  const [data, setData] = useState<any>({ languages: [], clusters: [], gsc: {} });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginProgress, setLoginProgress] = useState('Connecting to Google...');
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('missing');
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;
  
  const [sortConfig, setSortConfig] = useState<{ key: string | null, direction: 'asc' | 'desc' }>({ key: 'impressions', direction: 'desc' });
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [scanProgressPercent, setScanProgressPercent] = useState(0);
  
  const [opportunitiesMap, setOpportunitiesMap] = useState<Record<string, any[]>>({});
  const [brokenLinksMap, setBrokenLinksMap] = useState<Record<string, any[]>>({});
  const [inlinkResultsMap, setInlinkResultsMap] = useState<Record<string, any[]>>({});
  const [redirectsMap, setRedirectsMap] = useState<Record<string, any[]>>({});
  
  const opportunities = selectedLang ? (opportunitiesMap[selectedLang] || []) : [];
  const brokenLinks = selectedLang ? (brokenLinksMap[selectedLang] || []) : [];
  const inlinkResults = selectedLang ? (inlinkResultsMap[selectedLang] || []) : [];
  const redirects = selectedLang ? (redirectsMap[selectedLang] || []) : [];

  const isLinksScanned = selectedLang ? opportunitiesMap[selectedLang] !== undefined : false;
  const isBrokenScanned = selectedLang ? brokenLinksMap[selectedLang] !== undefined : false;
  const isInlinksScanned = selectedLang ? inlinkResultsMap[selectedLang] !== undefined : false;
  const isRedirectsScanned = selectedLang ? redirectsMap[selectedLang] !== undefined : false;

  const [expandedLinks, setExpandedLinks] = useState<string[]>([]);
  const [expandedBrokenLinks, setExpandedBrokenLinks] = useState<string[]>([]);
  const [expandedInlinks, setExpandedInlinks] = useState<string[]>([]);
  const [expandedRedirects, setExpandedRedirects] = useState<string[]>([]);

  const [analyzingUrls, setAnalyzingUrls] = useState<Record<string, boolean>>({});
  const [analysisResults, setAnalysisResults] = useState<Record<string, any>>({});
  const [customKeywords, setCustomKeywords] = useState<Record<string, string>>({});

  const getLocalImpressions = (gscNode: any, lang: string) => {
    if (!gscNode || !gscNode.country_impressions) return 0;
    const map: Record<string, string[]> = {
      'nl': ['nld', 'bel'],
      'fr': ['fra', 'bel', 'che', 'can'],
      'de': ['deu', 'aut', 'che'],
      'es': ['esp', 'mex', 'arg', 'col', 'per', 'chl'],
      'it': ['ita', 'che'],
      'pt': ['prt', 'bra'],
      'ja': ['jpn'],
      'ko': ['kor'],
      'sv': ['swe'],
      'no': ['nor'],
      'da': ['dnk'],
      'fi': ['fin'],
      'pl': ['pol'],
      'ru': ['rus'],
      'tr': ['tur'],
    };
    const targets = map[lang] || [];
    let total = 0;
    for (const country of targets) {
      total += (gscNode.country_impressions[country] || 0);
    }
    return total;
  };

  // CHANGE THIS TO YOUR HEROKU URL
  const API_BASE_URL = 'https://i18n-seo-analyzer-3d2678f53f5d.herokuapp.com'; 

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      localStorage.setItem('gsc_token', token);
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchGscData(token);
    } else {
      const savedToken = localStorage.getItem('gsc_token');
      if (savedToken) {
        fetchGscData(savedToken);
      }
    }
  }, []);

  useEffect(() => {
    setSearchQuery('');
    setCurrentPage(1);
    setExpandedLinks([]);
    setExpandedBrokenLinks([]);
    setExpandedInlinks([]);
    setExpandedRedirects([]);
    
    if (activeTab === 'inlinks') setSortConfig({ key: 'inlinks', direction: 'desc' });
    else if (activeTab === 'redirects') setSortConfig({ key: 'originalUrl', direction: 'asc' });
    else setSortConfig({ key: 'impressions', direction: 'desc' });
  }, [selectedLang, activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const initiateLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/login`;
  };

  const logout = () => {
    localStorage.removeItem('gsc_token');
    setIsConnected(false);
    setData({ languages: [], clusters: [], gsc: {} });
  };

  const fetchGscData = async (token: string) => {
    setIsLoading(true);
    setAuthError(null);
    setLoginProgress('Authenticating...');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/data`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Authentication expired or invalid. Please log in again.');
      }
      if (!res.body) throw new Error("No response body available for streaming");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; 
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.error) {
               throw new Error(parsed.error);
            }
            if (parsed.status === 'progress' && parsed.message) {
               setLoginProgress(parsed.message);
            }
            
            if (parsed.status === 'complete' && parsed.result) {
               const result = parsed.result;
               setData(result);
               if (result.languages && result.languages.length > 0) {
                 setSelectedLang(result.languages[0]);
               }
               setIsConnected(true);
            }
          } catch(e) { 
             console.error("JSON parse error on stream segment", e) 
          }
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch data", error);
      setAuthError(error.message);
      localStorage.removeItem('gsc_token');
    } finally {
      setIsLoading(false);
    }
  };

  const runFullAnalysis = async () => {
    if (!selectedLang) return;
    setIsScanning(true);
    setScanProgress('Initializing Scan...');
    setScanProgressPercent(0);

    try {
      const res = await fetch(`${API_BASE_URL}/api/scan_all`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ target_lang: selectedLang, clusters: data.clusters })
      });
      
      if (!res.body) throw new Error("No response body available for streaming");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; 
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            
            if (parsed.error) {
               console.error("Scanner Error:", parsed.error);
               setScanProgress("Error: " + parsed.error);
               continue;
            }
            if (parsed.progress) setScanProgressPercent(parsed.progress);
            if (parsed.message) setScanProgress(parsed.message);
            
            if (parsed.result) {
               const result = parsed.result;
               setOpportunitiesMap(prev => ({ ...prev, [selectedLang]: result.opportunities || [] }));
               setBrokenLinksMap(prev => ({ ...prev, [selectedLang]: result.brokenLinks || [] }));
               setInlinkResultsMap(prev => ({ ...prev, [selectedLang]: result.inlinks || [] }));
               setRedirectsMap(prev => ({ ...prev, [selectedLang]: result.redirects || [] }));
            }
          } catch(e) { 
             console.error("JSON parse error on stream segment", e) 
          }
        }
      }
    } catch (error) {
      console.error("Unified Batch Scan failed", error);
    } finally {
      setTimeout(() => {
        setScanProgress('');
        setScanProgressPercent(0);
        setIsScanning(false);
      }, 1500);
    }
  };

  const runSeoCheck = async (url: string, keyword: string) => {
    setAnalyzingUrls(prev => ({ ...prev, [url]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze_onpage?url=${encodeURIComponent(url)}&keyword=${encodeURIComponent(keyword)}`);
      const result = await res.json();
      setAnalysisResults(prev => ({ ...prev, [url]: result }));
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setAnalyzingUrls(prev => ({ ...prev, [url]: false }));
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 text-[#DFE3E8]" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-[#282C33]" /> 
      : <ArrowDown className="w-3 h-3 ml-1 text-[#282C33]" />;
  };

  const filteredData = useMemo(() => {
    if (!selectedLang || !data.clusters) return { missing: [], optimizations: [] };

    const missing: any[] = [];
    const optimizations: any[] = [];

    data.clusters.forEach((cluster: any, idx: number) => {
      const enUrl = cluster.en;
      if (!enUrl) return; 

      const localUrl = cluster[selectedLang];
      const enGsc = data.gsc[enUrl] || { impressions: 0, topKeyword: 'No Data' };

      const isBrand = enGsc.topKeyword && enGsc.topKeyword.toLowerCase().includes('lucid');
      const hasImpressions = enGsc.impressions > 0;
      const isTrueEnUrl = !data.languages.some((lang: string) => enUrl.includes(`/${lang}/`) || enUrl.endsWith(`/${lang}`));

      if (!localUrl && !isBrand && hasImpressions && isTrueEnUrl) {
        missing.push({
          id: `missing-${idx}`,
          enUrl: enUrl,
          keyword: enGsc.topKeyword,
          impressions: enGsc.impressions,
          localImpressions: getLocalImpressions(enGsc, selectedLang)
        });
      }

      if (localUrl) {
        const localGsc = data.gsc[localUrl] || { impressions: 0, topKeyword: 'No Data' };
        const isLocalBrand = localGsc.topKeyword && localGsc.topKeyword.toLowerCase().includes('lucid');

        if (!isLocalBrand) {
          optimizations.push({
            id: `opt-${idx}`,
            enUrl: enUrl,
            localUrl: localUrl,
            keyword: localGsc.topKeyword,
            impressions: localGsc.impressions
          });
        }
      }
    });

    return { missing, optimizations };
  }, [data, selectedLang]);

  const searchedMissing = useMemo(() => {
    if (!searchQuery) return filteredData.missing;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return filteredData.missing.filter((item: any) => (item.enUrl && item.enUrl.toLowerCase().includes(lowerQuery)));
  }, [filteredData.missing, searchQuery]);

  const searchedOptimizations = useMemo(() => {
    if (!searchQuery) return filteredData.optimizations;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return filteredData.optimizations.filter((item: any) => 
      (item.localUrl && item.localUrl.toLowerCase().includes(lowerQuery)) ||
      (item.enUrl && item.enUrl.toLowerCase().includes(lowerQuery))
    );
  }, [filteredData.optimizations, searchQuery]);
  
  const searchedInlinks = useMemo(() => {
    if (!searchQuery) return inlinkResults;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return inlinkResults.filter((item: any) => (item.url && item.url.toLowerCase().includes(lowerQuery)));
  }, [inlinkResults, searchQuery]);

  const searchedRedirects = useMemo(() => {
    if (!searchQuery) return redirects;
    const lowerQuery = searchQuery.toLowerCase().trim();
    return redirects.filter((item: any) => 
      (item.originalUrl && item.originalUrl.toLowerCase().includes(lowerQuery)) ||
      (item.destinationUrl && item.destinationUrl.toLowerCase().includes(lowerQuery))
    );
  }, [redirects, searchQuery]);

  const sortArray = (arr: any[]) => {
    if (!sortConfig.key) return arr;
    return [...arr].sort((a, b) => {
      let aVal = a[sortConfig.key!];
      let bVal = b[sortConfig.key!];

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedMissing = sortArray(searchedMissing);
  const sortedOptimizations = sortArray(searchedOptimizations);
  const sortedInlinks = sortArray(searchedInlinks);
  const sortedRedirects = sortArray(searchedRedirects);

  const groupedOpportunities = useMemo(() => {
    const grouped: Record<string, any> = {};
    opportunities.forEach(opp => {
      // Filter out links that are actually international links misidentified by the sitemap
      const isTrueEnLink = !data.languages.some((lang: string) => 
        opp.enLink.includes(`/${lang}/`) || opp.enLink.endsWith(`/${lang}`)
      );
      
      if (isTrueEnLink) {
        if (!grouped[opp.enLink]) {
          grouped[opp.enLink] = { enLink: opp.enLink, i18nLink: opp.i18nLink, sources: [] };
        }
        if (!grouped[opp.enLink].sources.includes(opp.source)) {
          grouped[opp.enLink].sources.push(opp.source);
        }
      }
    });
    return Object.values(grouped).sort((a: any, b: any) => b.sources.length - a.sources.length);
  }, [opportunities, data.languages]);

  const groupedBroken = useMemo(() => {
    const grouped: Record<string, any> = {};
    brokenLinks.forEach(link => {
      if (!grouped[link.brokenLink]) {
        grouped[link.brokenLink] = { brokenLink: link.brokenLink, sources: [] };
      }
      if (!grouped[link.brokenLink].sources.includes(link.source)) {
        grouped[link.brokenLink].sources.push(link.source);
      }
    });
    return Object.values(grouped).sort((a: any, b: any) => b.sources.length - a.sources.length);
  }, [brokenLinks]);

  const toggleLink = (linkUrl: string) => setExpandedLinks(prev => prev.includes(linkUrl) ? prev.filter(l => l !== linkUrl) : [...prev, linkUrl]);
  const toggleBroken = (linkUrl: string) => setExpandedBrokenLinks(prev => prev.includes(linkUrl) ? prev.filter(l => l !== linkUrl) : [...prev, linkUrl]);
  const toggleInlink = (linkUrl: string) => setExpandedInlinks(prev => prev.includes(linkUrl) ? prev.filter(l => l !== linkUrl) : [...prev, linkUrl]);
  const toggleRedirect = (linkUrl: string) => setExpandedRedirects(prev => prev.includes(linkUrl) ? prev.filter(l => l !== linkUrl) : [...prev, linkUrl]);

  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (activeTab === 'missing') {
      headers = ['English URL', 'Total EN Impressions', `Local Market Impressions (${selectedLang?.toUpperCase()})`, 'Top Keyword'];
      rows = sortedMissing.map(item => [item.enUrl, item.impressions, item.localImpressions, item.keyword]);
    } else if (activeTab === 'optimize') {
      headers = ['Localized URL', 'Original EN URL', 'Local Impressions', 'Target Keyword', 'Title Match', 'H1 Match', 'H2 Match', 'Mentions'];
      rows = sortedOptimizations.map(item => {
        const targetKeyword = customKeywords[item.localUrl] !== undefined ? customKeywords[item.localUrl] : item.keyword;
        const analysis = analysisResults[item.localUrl];
        return [
          item.localUrl, item.enUrl, item.impressions, targetKeyword,
          analysis ? analysis.inTitle : 'N/A',
          analysis ? analysis.inH1 : 'N/A',
          analysis ? analysis.inH2 : 'N/A',
          analysis ? analysis.wordCount : 'N/A'
        ];
      });
    } else if (activeTab === 'inlinks') {
      headers = ['Localized Page URL', 'Total Inlinks', 'Unique Structural Inlinks', 'Source Pages'];
      rows = sortedInlinks.map(item => [item.url, item.inlinks, item.uniqueInlinks, item.sources.map((s: any) => `${s.url} [${s.anchor}]`).join(' | ')]);
    } else if (activeTab === 'redirects') {
      headers = ['Original Link', 'Destination', 'Status Code', 'Source Pages'];
      rows = sortedRedirects.map(item => [item.originalUrl, item.destinationUrl, item.statusCode, (item.sources || []).join(' | ')]);
    } else if (activeTab === 'links') {
      headers = ['English Link Found', 'Target I18N Link', 'Source Pages'];
      rows = groupedOpportunities.map(item => [item.enLink, item.i18nLink, item.sources.join(' | ')]);
    } else if (activeTab === 'broken') {
      headers = ['Broken Link', 'Source Pages'];
      rows = groupedBroken.map(item => [item.brokenLink, item.sources.join(' | ')]);
    }

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvContent = [headers.map(escapeCsv).join(","), ...rows.map(row => row.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `i18n-seo-export-${activeTab}-${selectedLang || 'data'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const PaginationControls = ({ totalItems }: { totalItems: number }) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    return (
      <div className="bg-white border-t border-[#DFE3E8] px-6 py-4 flex items-center justify-between shrink-0 z-20 sticky bottom-0 w-full rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <span className="text-sm text-[#4C535D]">
          Showing <span className="font-semibold text-[#282C33]">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-semibold text-[#282C33]">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span> of <span className="font-semibold text-[#282C33]">{totalItems}</span> results
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 border border-[#DFE3E8] rounded-md text-sm font-medium text-[#282C33] disabled:opacity-50 hover:bg-[#F2F3F5] transition-colors"
          >
            Previous
          </button>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 border border-[#DFE3E8] rounded-md text-sm font-medium text-[#282C33] disabled:opacity-50 hover:bg-[#F2F3F5] transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#F2F3F5] flex items-center justify-center p-6 font-['Inter',sans-serif]">
        <div className="bg-white p-10 rounded-2xl border border-[#DFE3E8] shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#F2F3F5] rounded-full flex items-center justify-center mx-auto mb-6">
            <Globe className="w-8 h-8 text-[#282C33]" />
          </div>
          <h1 className="text-2xl font-bold text-[#282C33] mb-2">i18n SEO Analyzer</h1>
          <p className="text-[#4C535D] mb-6">Log in with your Google Account to securely retrieve your Search Console data.</p>
          
          {authError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg text-left">
              <AlertTriangle className="w-4 h-4 inline mr-1" /> {authError}
            </div>
          )}

          <button 
            onClick={initiateLogin}
            disabled={isLoading}
            className="w-full bg-[#1071E5] hover:bg-[#0C56B6] text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>{loginProgress}</span>
              </>
            ) : "Connect & Analyze"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F2F3F5] flex font-['Inter',sans-serif] overflow-hidden">
      <aside className="w-64 bg-white border-r border-[#DFE3E8] flex flex-col h-full shrink-0 z-20 shadow-sm">
        <div className="p-6 border-b border-[#DFE3E8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#282C33] p-2 rounded-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-[#282C33] tracking-tight text-lg">i18n SEO</span>
          </div>
          <button onClick={logout} className="text-[#4C535D] hover:text-red-500 transition-colors" title="Log Out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-[#4C535D] uppercase tracking-wider mb-4 px-2">Discovered Markets</div>
          <ul className="space-y-1">
            {data.languages.map((lang: string) => (
              <li key={lang}>
                <button 
                  onClick={() => setSelectedLang(lang)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${selectedLang === lang ? 'bg-[#F2F3F5] text-[#282C33]' : 'text-[#4C535D] hover:bg-[#F2F3F5] hover:text-[#282C33]'}`}
                >
                  <span>{lang.toUpperCase()} Subfolder</span>
                  {selectedLang === lang && <ChevronRight className="w-4 h-4" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#F8F9FA]">
        
        <div className="bg-white border-b border-[#DFE3E8] px-8 pt-6 pb-0 shrink-0 z-20 shadow-sm transition-all duration-300">
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('missing')} className={`pb-4 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors shrink-0 ${activeTab === 'missing' ? 'border-[#282C33] text-[#282C33]' : 'border-transparent text-[#4C535D] hover:text-[#282C33]'}`}>
              <AlertTriangle className="w-4 h-4" /> Missing Translations ({sortedMissing.length})
            </button>
            <button onClick={() => setActiveTab('optimize')} className={`pb-4 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors shrink-0 ${activeTab === 'optimize' ? 'border-[#282C33] text-[#282C33]' : 'border-transparent text-[#4C535D] hover:text-[#282C33]'}`}>
              <Zap className="w-4 h-4" /> Keyword Optimizations ({sortedOptimizations.length})
            </button>
            <button onClick={() => setActiveTab('inlinks')} className={`pb-4 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors shrink-0 ${activeTab === 'inlinks' ? 'border-[#282C33] text-[#282C33]' : 'border-transparent text-[#4C535D] hover:text-[#282C33]'}`}>
              <LinkIcon className="w-4 h-4" /> Internal Inlinks
            </button>
            <button onClick={() => setActiveTab('redirects')} className={`pb-4 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors shrink-0 ${activeTab === 'redirects' ? 'border-[#282C33] text-[#282C33]' : 'border-transparent text-[#4C535D] hover:text-[#282C33]'}`}>
              <ArrowRightLeft className="w-4 h-4" /> 301 Redirects
            </button>
            <button onClick={() => setActiveTab('links')} className={`pb-4 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors shrink-0 ${activeTab === 'links' ? 'border-[#282C33] text-[#282C33]' : 'border-transparent text-[#4C535D] hover:text-[#282C33]'}`}>
              <Edit3 className="w-4 h-4" /> Link Updates
            </button>
            <button onClick={() => setActiveTab('broken')} className={`pb-4 px-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors shrink-0 ${activeTab === 'broken' ? 'border-[#282C33] text-[#282C33]' : 'border-transparent text-[#4C535D] hover:text-[#282C33]'}`}>
              <XCircle className="w-4 h-4" /> 404 Pages
            </button>
          </div>
        </div>

        {/* Live Progress Bar UI */}
        {isScanning && (
          <div className="bg-white border-b border-[#DFE3E8] px-8 py-5 shrink-0 z-10 shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-semibold text-[#1071E5] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {scanProgress}
              </span>
              <span className="text-sm font-bold text-[#282C33]">{scanProgressPercent}%</span>
            </div>
            <div className="w-full bg-[#F2F3F5] rounded-full h-2 overflow-hidden shadow-inner">
              <div 
                className="bg-[#1071E5] h-2 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${scanProgressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col p-6">
          
          {}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0">
            <div className="w-full sm:w-80 relative">
              {(activeTab === 'missing' || activeTab === 'optimize' || activeTab === 'inlinks' || activeTab === 'redirects') && (
                <>
                  <Search className="w-4 h-4 text-[#4C535D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search URLs..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2.5 w-full text-sm border border-[#DFE3E8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#282C33] shadow-sm text-[#282C33]"
                  />
                </>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleExportCsv}
                className="bg-white border border-[#DFE3E8] hover:bg-[#F2F3F5] text-[#282C33] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>

              {(['inlinks', 'redirects', 'links', 'broken'].includes(activeTab) || isScanning) && (
                <button 
                  onClick={runFullAnalysis}
                  disabled={isScanning}
                  className="bg-[#1071E5] hover:bg-[#0C56B6] text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-70 flex items-center gap-2 whitespace-nowrap"
                >
                  {isScanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isScanning ? "Scanning..." : "Run Full Link Analysis"}
                </button>
              )}
            </div>
          </div>

          {}
          {activeTab === 'missing' && (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-[#DFE3E8] overflow-hidden">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm relative">
                  <thead className="bg-[#F8F9FA] border-b border-[#DFE3E8] text-[#4C535D] uppercase text-xs font-semibold sticky top-0 z-10">
                    <tr>
                      <th onClick={() => handleSort('enUrl')} className="px-6 py-4 w-4/12 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                        <div className="flex items-center">English URL {getSortIcon('enUrl')}</div>
                      </th>
                      <th onClick={() => handleSort('impressions')} className="px-6 py-4 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                        <div className="flex items-center" title="Total global impressions for the EN page">Global EN Impr. {getSortIcon('impressions')}</div>
                      </th>
                      <th onClick={() => handleSort('localImpressions')} className="px-6 py-4 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                        <div className="flex items-center" title="Impressions coming specifically from countries speaking this language">Local Market Impr. {getSortIcon('localImpressions')}</div>
                      </th>
                      <th onClick={() => handleSort('keyword')} className="px-6 py-4 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                        <div className="flex items-center">Top Keyword {getSortIcon('keyword')}</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE3E8]">
                    {paginatedMissing.map((page: any, idx: number) => (
                      <tr key={idx} className="hover:bg-[#F2F3F5] transition-colors">
                        <td className="px-6 py-4 align-middle">
                          <a href={page.enUrl} target="_blank" rel="noreferrer" className="text-[#282C33] hover:underline font-medium flex items-center gap-1 w-max">
                            {page.enUrl.replace(/^https?:\/\/[^\/]+/, '')} <ExternalLink className="w-3 h-3 inline shrink-0" />
                          </a>
                        </td>
                        <td className="px-6 py-4 align-middle font-semibold text-[#4C535D]">
                          {page.impressions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 align-middle font-semibold text-[#1071E5]">
                          {page.localImpressions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <span className="bg-[#F2F3F5] px-2.5 py-1 rounded text-[#282C33] font-medium border border-[#DFE3E8]">{page.keyword}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PaginationControls totalItems={sortedMissing.length} />
            </div>
          )}

          {}
          {activeTab === 'optimize' && (
            <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-[#DFE3E8] overflow-hidden">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm relative">
                  <thead className="bg-[#F8F9FA] border-b border-[#DFE3E8] text-[#4C535D] uppercase text-xs font-semibold sticky top-0 z-10">
                    <tr>
                      <th onClick={() => handleSort('localUrl')} className="px-6 py-4 w-4/12 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                        <div className="flex items-center">Localized URL {getSortIcon('localUrl')}</div>
                      </th>
                      <th onClick={() => handleSort('impressions')} className="px-6 py-4 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                        <div className="flex items-center">Local Impressions {getSortIcon('impressions')}</div>
                      </th>
                      <th className="px-6 py-4">
                        Target Keyword (Editable)
                      </th>
                      <th className="px-6 py-4 bg-[#F8F9FA] w-3/12">
                        On-Page Analysis
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DFE3E8]">
                    {paginatedOptimizations.map((page: any) => {
                      const targetKeyword = customKeywords[page.localUrl] !== undefined ? customKeywords[page.localUrl] : page.keyword;
                      
                      return (
                        <tr key={page.id} className="hover:bg-[#F2F3F5] transition-colors">
                          <td className="px-6 py-4 align-middle">
                            <a href={page.localUrl} target="_blank" rel="noreferrer" className="text-[#282C33] hover:underline font-medium flex items-center gap-1 w-max">
                              {page.localUrl.replace(/^https?:\/\/[^\/]+/, '')} <ExternalLink className="w-3 h-3 inline shrink-0" />
                            </a>
                            <div className="text-xs text-[#4C535D] mt-1.5 flex items-center gap-1">
                              Original: {page.enUrl.replace(/^https?:\/\/[^\/]+/, '')}
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle font-semibold text-[#282C33]">
                            {page.impressions.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <input 
                              type="text"
                              value={targetKeyword}
                              onChange={(e) => setCustomKeywords(prev => ({ ...prev, [page.localUrl]: e.target.value }))}
                              placeholder="Type target keyword..."
                              className="bg-white px-2.5 py-1.5 rounded-lg text-[#282C33] font-medium border border-[#DFE3E8] focus:outline-none focus:ring-2 focus:ring-[#282C33] w-full max-w-[200px] shadow-sm transition-shadow"
                            />
                          </td>
                          <td className="px-6 py-4 align-middle">
                            {!analyzingUrls[page.localUrl] && !analysisResults[page.localUrl] ? (
                              <button 
                                onClick={() => runSeoCheck(page.localUrl, targetKeyword)}
                                className="text-xs bg-[#1071E5] text-white px-3 py-1.5 rounded-lg hover:bg-[#0C56B6] font-medium transition-colors shadow-sm"
                              >
                                Run Analysis
                              </button>
                            ) : analyzingUrls[page.localUrl] ? (
                              <span className="text-sm text-[#4C535D] font-medium flex items-center gap-2">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1071E5]" /> Scanning...
                              </span>
                            ) : (
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className={`px-2 py-0.5 rounded font-semibold border ${analysisResults[page.localUrl].inTitle ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>Title</span>
                                <span className={`px-2 py-0.5 rounded font-semibold border ${analysisResults[page.localUrl].inH1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>H1</span>
                                <span className={`px-2 py-0.5 rounded font-semibold border ${analysisResults[page.localUrl].inH2 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>H2</span>
                                <span className="text-[#4C535D] font-medium ml-1 text-xs">{analysisResults[page.localUrl].wordCount} mentions</span>
                                <button 
                                  onClick={() => {
                                    const newRes = {...analysisResults};
                                    delete newRes[page.localUrl];
                                    setAnalysisResults(newRes);
                                  }}
                                  className="ml-2 text-[#4C535D] hover:text-red-500 transition-colors"
                                  title="Clear analysis to run again"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls totalItems={sortedOptimizations.length} />
            </div>
          )}

          {}
          {activeTab === 'inlinks' && (
            <div className="flex flex-col h-full overflow-hidden">
              {!isInlinksScanned ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#4C535D] bg-white rounded-xl border border-[#DFE3E8] border-dashed">
                  <LinkIcon className="w-12 h-12 text-[#DFE3E8] mb-4" />
                  {isScanning ? "Unified batch scan in progress. Data will appear shortly..." : `Click 'Run Full Link Analysis' above to map out all architectural links for ${selectedLang?.toUpperCase()}.`}
                </div>
              ) : (
                <div className="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-[#DFE3E8] overflow-hidden">
                  {sortedInlinks.length > 0 ? (
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-sm relative">
                        <thead className="bg-[#F8F9FA] border-b border-[#DFE3E8] text-[#4C535D] uppercase text-xs font-semibold sticky top-0 z-10">
                          <tr>
                            <th onClick={() => handleSort('url')} className="px-6 py-4 w-5/12 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                              <div className="flex items-center">Localized Page URL {getSortIcon('url')}</div>
                            </th>
                            <th onClick={() => handleSort('inlinks')} className="px-6 py-4 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                              <div className="flex items-center" title="Total raw link tags found">Total Inlinks {getSortIcon('inlinks')}</div>
                            </th>
                            <th onClick={() => handleSort('uniqueInlinks')} className="px-6 py-4 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                              <div className="flex items-center" title="Links with unique anchor text (groups structural/nav links together)">Unique Inlinks {getSortIcon('uniqueInlinks')}</div>
                            </th>
                            <th className="px-6 py-4 bg-[#F8F9FA]"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DFE3E8]">
                          {paginatedInlinks.map((page: any, idx: number) => {
                            const isExpanded = expandedInlinks.includes(page.url);
                            return (
                              <React.Fragment key={idx}>
                                <tr 
                                  className={`transition-colors ${page.inlinks === 0 ? 'bg-[#FFF0F0] hover:bg-red-50' : 'hover:bg-[#F2F3F5] cursor-pointer'}`}
                                  onClick={() => page.inlinks > 0 && toggleInlink(page.url)}
                                >
                                  <td className="px-6 py-4 align-middle">
                                    <a href={page.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className={`font-medium flex items-center gap-1 w-max hover:underline ${page.inlinks === 0 ? 'text-[#FF3D3D]' : 'text-[#282C33]'}`}>
                                      {page.url.replace(/^https?:\/\/[^\/]+/, '')} <ExternalLink className="w-3 h-3 inline shrink-0" />
                                    </a>
                                  </td>
                                  <td className="px-6 py-4 align-middle">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-lg font-bold ${page.inlinks === 0 ? 'text-[#FF3D3D]' : 'text-[#282C33]'}`}>
                                        {page.inlinks}
                                      </span>
                                      {page.inlinks === 0 && <span className="text-xs bg-[#FF3D3D] text-white px-2 py-0.5 rounded font-medium uppercase tracking-wide">Orphan</span>}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 align-middle">
                                    <span className="text-[#4C535D] font-semibold bg-[#F2F3F5] px-2.5 py-1 rounded-md border border-[#DFE3E8]">
                                      {page.uniqueInlinks || 0}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 align-middle text-right">
                                    {page.inlinks > 0 && (
                                      isExpanded ? <ChevronDown className="w-5 h-5 text-[#4C535D] inline" /> : <ChevronRight className="w-5 h-5 text-[#4C535D] inline" />
                                    )}
                                  </td>
                                </tr>
                                {isExpanded && page.inlinks > 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-0 border-b border-[#DFE3E8] bg-[#F8F9FA]">
                                      <div className="px-6 py-4 shadow-inner">
                                        <div className="text-xs font-semibold text-[#4C535D] uppercase tracking-wider mb-3">Linked From ({page.sources.length} Pages)</div>
                                        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                          {page.sources.map((source: any, sIdx: number) => (
                                            <li key={sIdx} className="text-sm flex items-center justify-between group hover:bg-white p-1 rounded transition-colors">
                                              <a href={source.url} target="_blank" rel="noreferrer" className="text-[#282C33] hover:underline flex items-center gap-1.5 truncate">
                                                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#4C535D]" />
                                                {source.url.replace(/^https?:\/\/[^\/]+/, '')}
                                              </a>
                                              <span className="text-xs text-[#4C535D] bg-white border border-[#DFE3E8] px-2 py-0.5 rounded ml-4 truncate max-w-[200px]" title="Anchor Text">
                                                "{source.anchor}"
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-12 text-[#4C535D]">
                      Great news! No orphan pages or inlink data found.
                    </div>
                  )}
                  {sortedInlinks.length > 0 && <PaginationControls totalItems={sortedInlinks.length} />}
                </div>
              )}
            </div>
          )}

          {}
          {activeTab === 'redirects' && (
            <div className="flex flex-col h-full overflow-hidden">
              {!isRedirectsScanned ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#4C535D] bg-white rounded-xl border border-[#DFE3E8] border-dashed">
                  <ArrowRightLeft className="w-12 h-12 text-[#DFE3E8] mb-4" />
                  {isScanning ? "Unified batch scan in progress. Data will appear shortly..." : `Click 'Run Full Link Analysis' above to map out all architectural links for ${selectedLang?.toUpperCase()}.`}
                </div>
              ) : (
                <div className="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-[#DFE3E8] overflow-hidden">
                  {sortedRedirects.length > 0 ? (
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-sm relative">
                        <thead className="bg-[#F8F9FA] border-b border-[#DFE3E8] text-[#4C535D] uppercase text-xs font-semibold sticky top-0 z-10">
                          <tr>
                            <th onClick={() => handleSort('originalUrl')} className="px-6 py-4 w-5/12 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                              <div className="flex items-center">Original Link Found {getSortIcon('originalUrl')}</div>
                            </th>
                            <th onClick={() => handleSort('destinationUrl')} className="px-6 py-4 w-5/12 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                              <div className="flex items-center">Redirect Destination {getSortIcon('destinationUrl')}</div>
                            </th>
                            <th onClick={() => handleSort('statusCode')} className="px-6 py-4 cursor-pointer hover:bg-[#DFE3E8] transition-colors group">
                              <div className="flex items-center">Status {getSortIcon('statusCode')}</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DFE3E8]">
                          {paginatedRedirects.map((page: any, idx: number) => {
                            const isExpanded = expandedRedirects.includes(page.originalUrl);
                            return (
                              <React.Fragment key={idx}>
                                <tr 
                                  className="hover:bg-[#F2F3F5] transition-colors cursor-pointer"
                                  onClick={() => toggleRedirect(page.originalUrl)}
                                >
                                  <td className="px-6 py-4 align-middle">
                                    <a href={page.originalUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#282C33] hover:underline font-medium break-all flex items-center gap-1 w-max">
                                      {page.originalUrl.replace(/^https?:\/\/[^\/]+/, '')} <ExternalLink className="w-3 h-3 inline shrink-0" />
                                    </a>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <span className="bg-[#F2F3F5] border border-[#DFE3E8] px-2 py-0.5 rounded text-xs font-semibold text-[#4C535D]">
                                        Found on {page.sources?.length || 0} page{(page.sources?.length || 0) !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 align-middle">
                                    <a href={page.destinationUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[#4C535D] hover:underline break-all flex items-center gap-1 w-max">
                                      {page.destinationUrl.replace(/^https?:\/\/[^\/]+/, '')} <ExternalLink className="w-3 h-3 inline shrink-0" />
                                    </a>
                                  </td>
                                  <td className="px-6 py-4 align-middle flex justify-between items-center">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-semibold text-xs ${page.statusCode === 301 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                      {page.statusCode}
                                    </span>
                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-[#4C535D] ml-2" /> : <ChevronRight className="w-5 h-5 text-[#4C535D] ml-2" />}
                                  </td>
                                </tr>
                                {isExpanded && page.sources && page.sources.length > 0 && (
                                  <tr>
                                    <td colSpan={3} className="p-0 border-b border-[#DFE3E8] bg-[#F8F9FA]">
                                      <div className="px-6 py-4 shadow-inner">
                                        <div className="text-xs font-semibold text-[#4C535D] uppercase tracking-wider mb-3">Pages Using This Outdated Link</div>
                                        <ul className="space-y-2">
                                          {page.sources.map((source: string, sIdx: number) => (
                                            <li key={sIdx} className="text-sm">
                                              <a href={source} target="_blank" rel="noreferrer" className="text-[#282C33] hover:underline flex items-center gap-1.5 w-max">
                                                <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#4C535D]" />
                                                {source.replace(/^https?:\/\/[^\/]+/, '')}
                                              </a>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center p-12 text-[#4C535D]">
                      Great news! No outdated internal links pointing to 301 redirects found.
                    </div>
                  )}
                  {sortedRedirects.length > 0 && <PaginationControls totalItems={sortedRedirects.length} />}
                </div>
              )}
            </div>
          )}

          {}
          {activeTab === 'links' && (
            <div className="flex flex-col h-full overflow-hidden">
              {!isLinksScanned ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#4C535D] bg-white rounded-xl border border-[#DFE3E8] border-dashed">
                  <Edit3 className="w-12 h-12 text-[#DFE3E8] mb-4" />
                  {isScanning ? "Unified batch scan in progress. Data will appear shortly..." : `Click 'Run Full Link Analysis' above to map out all architectural links for ${selectedLang?.toUpperCase()}.`}
                </div>
              ) : (
                <div className="flex-1 overflow-auto pb-10">
                  {groupedOpportunities.length > 0 ? (
                    <div className="space-y-3 pr-2">
                      {groupedOpportunities.map((group: any, idx: number) => {
                        const isExpanded = expandedLinks.includes(group.enLink);
                        return (
                          <div key={idx} className="border border-[#DFE3E8] rounded-xl overflow-hidden bg-white shadow-sm">
                            <button 
                              onClick={() => toggleLink(group.enLink)}
                              className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#F8F9FA] transition-colors text-left"
                            >
                              <div className="flex-1">
                                <div className="text-sm text-[#4C535D] font-medium mb-1">English Link Found</div>
                                <div className="font-medium text-[#282C33] break-all pr-4">{group.enLink.replace(/^https?:\/\/[^\/]+/, '')}</div>
                                <div className="text-sm text-emerald-600 font-medium mt-1">Should be updated to: {group.i18nLink.replace(/^https?:\/\/[^\/]+/, '')}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="bg-[#F2F3F5] border border-[#DFE3E8] px-3 py-1 rounded-full text-sm font-semibold text-[#282C33]">
                                  Found on {group.sources.length} page{group.sources.length > 1 ? 's' : ''}
                                </span>
                                {isExpanded ? <ChevronDown className="w-5 h-5 text-[#4C535D]" /> : <ChevronRight className="w-5 h-5 text-[#4C535D]" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="p-4 bg-[#F8F9FA] border-t border-[#DFE3E8] shadow-inner">
                                <div className="text-xs font-semibold text-[#4C535D] uppercase tracking-wider mb-3">Source Pages to Update</div>
                                <ul className="space-y-2">
                                  {group.sources.map((source: string, sIdx: number) => (
                                    <li key={sIdx} className="text-sm">
                                      <a href={source} target="_blank" rel="noreferrer" className="text-[#282C33] hover:underline flex items-center gap-1.5 w-max">
                                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#4C535D]" />
                                        {source.replace(/^https?:\/\/[^\/]+/, '')}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#4C535D] bg-white rounded-xl border border-[#DFE3E8] h-full">
                      Great news! No English links found on localized pages.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {}
          {activeTab === 'broken' && (
            <div className="flex flex-col h-full overflow-hidden">
              {!isBrokenScanned ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#4C535D] bg-white rounded-xl border border-[#DFE3E8] border-dashed">
                  <XCircle className="w-12 h-12 text-[#DFE3E8] mb-4" />
                  {isScanning ? "Unified batch scan in progress. Data will appear shortly..." : `Click 'Run Full Link Analysis' above to map out all architectural links for ${selectedLang?.toUpperCase()}.`}
                </div>
              ) : (
                <div className="flex-1 overflow-auto pb-10">
                  {groupedBroken.length > 0 ? (
                    <div className="space-y-3 pr-2">
                      {groupedBroken.map((group: any, idx: number) => {
                        const isExpanded = expandedBrokenLinks.includes(group.brokenLink);
                        return (
                          <div key={idx} className="border border-red-200 rounded-xl overflow-hidden bg-white shadow-sm">
                            <button 
                              onClick={() => toggleBroken(group.brokenLink)}
                              className="w-full flex items-center justify-between p-4 bg-[#FFF0F0] hover:bg-red-50 transition-colors text-left"
                            >
                              <div className="flex-1">
                                <div className="text-sm text-[#FF3D3D] font-bold mb-1 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> 404 Broken Link</div>
                                <div className="font-medium text-[#282C33] break-all pr-4">{group.brokenLink.replace(/^https?:\/\/[^\/]+/, '')}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="bg-white border border-red-200 px-3 py-1 rounded-full text-sm font-semibold text-red-600">
                                  Found on {group.sources.length} page{group.sources.length > 1 ? 's' : ''}
                                </span>
                                {isExpanded ? <ChevronDown className="w-5 h-5 text-[#4C535D]" /> : <ChevronRight className="w-5 h-5 text-[#4C535D]" />}
                              </div>
                            </button>
                            {isExpanded && (
                              <div className="p-4 bg-white border-t border-red-100 shadow-inner">
                                <div className="text-xs font-semibold text-[#4C535D] uppercase tracking-wider mb-3">Source Pages</div>
                                <ul className="space-y-2">
                                  {group.sources.map((source: string, sIdx: number) => (
                                    <li key={sIdx} className="text-sm">
                                      <a href={source} target="_blank" rel="noreferrer" className="text-[#282C33] hover:underline flex items-center gap-1.5 w-max">
                                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#4C535D]" />
                                        {source.replace(/^https?:\/\/[^\/]+/, '')}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#4C535D] bg-white rounded-xl border border-[#DFE3E8] h-full">
                      Great news! No internal 404 broken links found.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}