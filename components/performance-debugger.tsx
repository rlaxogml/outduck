"use client";

import { useState, useEffect, useMemo } from "react";
import { performanceTracker, type PerformanceLog } from "@/lib/performance";
import { Activity, Clock, Trash2, X, ChevronUp, AlertCircle, ShieldAlert, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function PerformanceDebugger() {
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'server' | 'client' | 'auth' | 'api'>('all');
  const pathname = usePathname();
  const [navMetrics, setNavMetrics] = useState<{
    dns: number;
    tcp: number;
    ssl: number;
    ttfb: number;
    download: number;
    domReady: number;
    total: number;
  } | null>(null);

  // No longer clearing on pathname change to prevent race condition.
  // We filter logs dynamically by the current route instead.

  useEffect(() => {
    const handleLoad = () => {
      setTimeout(() => {
        const entries = performance.getEntriesByType('navigation');
        if (entries && entries.length > 0) {
          const nav = entries[0] as PerformanceNavigationTiming;
          const dns = nav.domainLookupEnd - nav.domainLookupStart;
          const tcp = nav.connectEnd - nav.connectStart;
          const ssl = nav.secureConnectionStart > 0 ? (nav.connectEnd - nav.secureConnectionStart) : 0;
          const ttfb = nav.responseStart - nav.requestStart;
          const download = nav.responseEnd - nav.responseStart;
          const domReady = nav.domContentLoadedEventEnd - nav.responseEnd;
          const total = nav.duration;

          setNavMetrics({
            dns: Math.max(0, dns),
            tcp: Math.max(0, tcp - ssl),
            ssl: Math.max(0, ssl),
            ttfb: Math.max(0, ttfb),
            download: Math.max(0, download),
            domReady: Math.max(0, domReady),
            total: Math.max(0, total)
          });
        }
      }, 500);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [pathname]);

  useEffect(() => {
    // Check environment or debug query param
    const isDev = process.env.NODE_ENV === 'development';
    const hasDebugFlag = new URLSearchParams(window.location.search).has('debug_perf');
    
    if (isDev || hasDebugFlag) {
      setIsVisible(true);
      setLogs(performanceTracker.getLogs());
      
      const unsubscribe = performanceTracker.subscribe(() => {
        setLogs(performanceTracker.getLogs());
      });
      
      return unsubscribe;
    }
  }, []);

  const filteredLogs = useMemo(() => {
    const pageLogs = logs.filter(log => !log.pathname || log.pathname === pathname);
    if (activeFilter === 'all') return pageLogs;
    return pageLogs.filter(log => log.type === activeFilter);
  }, [logs, activeFilter, pathname]);

  const stats = useMemo(() => {
    const pageLogs = logs.filter(log => !log.pathname || log.pathname === pathname);
    if (pageLogs.length === 0) return { total: 0, server: 0, client: 0, count: 0 };
    
    // Server total is max of parallel queries plus sequential ones
    const serverLogs = pageLogs.filter(l => l.type === 'server');
    const serverMax = serverLogs.length > 0 ? Math.max(...serverLogs.map(l => l.duration)) : 0;
    
    const clientLogs = pageLogs.filter(l => l.type === 'client');
    const clientMax = clientLogs.length > 0 ? Math.max(...clientLogs.map(l => l.duration)) : 0;

    const authLogs = pageLogs.filter(l => l.type === 'auth');
    const authMax = authLogs.filter(l => l.duration > 0).length > 0 ? Math.max(...authLogs.map(l => l.duration)) : 0;

    const apiLogs = pageLogs.filter(l => l.type === 'api');
    const apiMax = apiLogs.filter(l => l.duration > 0).length > 0 ? Math.max(...apiLogs.map(l => l.duration)) : 0;

    // Estimate total real-world loading wait time:
    // Since client queries, auth checks, and api requests mostly run in parallel during client mount,
    // the actual client-side blocking wait is roughly the max of these concurrent client tasks.
    const clientTime = Math.max(clientMax, authMax, apiMax);
    const totalTime = serverMax + clientTime;
    
    return {
      total: totalTime,
      server: serverMax,
      client: clientTime,
      count: pageLogs.length
    };
  }, [logs, pathname]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[9999] font-sans antialiased select-none">
      {/* Minimized Toggle Trigger Badge */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-3 bg-slate-900/90 text-white rounded-2xl border border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-md",
            stats.total > 500
              ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              : stats.total > 150
              ? "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              : "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          )}
        >
          <Clock className={cn("w-4 h-4 text-slate-300", stats.total > 300 && "animate-pulse")} />
          <div className="flex flex-col items-start leading-none gap-0.5">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">로딩 시간</span>
            <span className={cn(
              "text-xs font-extrabold",
              stats.total > 500 ? "text-red-400" : stats.total > 150 ? "text-amber-400" : "text-emerald-400"
            )}>
              {stats.total.toFixed(0)}ms
            </span>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-1" />
        </button>
      )}

      {/* Expanded Debug Panel */}
      {isOpen && (
        <div className="w-[340px] sm:w-[380px] max-h-[500px] bg-slate-950/95 border border-slate-800 text-slate-100 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 backdrop-blur-lg">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-900 flex items-center justify-between bg-slate-900/40">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-extrabold tracking-tight">Outduck 성능 디버거</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => performanceTracker.clear()}
                title="로그 비우기"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 divide-x divide-slate-900 bg-slate-950 border-b border-slate-900">
            <div className="px-4 py-3 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold">합계 시간</span>
              <span className={cn(
                "text-sm font-extrabold mt-0.5",
                stats.total > 500 ? "text-red-400" : stats.total > 150 ? "text-amber-400" : "text-emerald-400"
              )}>
                {stats.total.toFixed(0)}ms
              </span>
            </div>
            <div className="px-4 py-3 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold">서버 대기</span>
              <span className="text-sm font-extrabold text-blue-400 mt-0.5">
                {stats.server.toFixed(0)}ms
              </span>
            </div>
            <div className="px-4 py-3 flex flex-col items-center">
              <span className="text-[10px] text-slate-500 font-bold">클라이언트</span>
              <span className="text-sm font-extrabold text-purple-400 mt-0.5">
                {stats.client.toFixed(0)}ms
              </span>
            </div>
          </div>

          {/* Network Diagnostics Section */}
          {navMetrics && navMetrics.total > 0 && (
            <div className="px-5 py-3 bg-slate-900/30 border-b border-slate-900 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 font-extrabold text-slate-300 mb-2">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>접속 네트워크 상세 분석 (새로고침 기준)</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10px]">
                <div className="flex justify-between border-b border-slate-900/50 pb-0.5">
                  <span>DNS 조회:</span>
                  <span className="text-slate-300">{navMetrics.dns.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between border-b border-slate-900/50 pb-0.5">
                  <span>TCP 연결:</span>
                  <span className="text-slate-300">{navMetrics.tcp.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between border-b border-slate-900/50 pb-0.5">
                  <span>SSL 보안:</span>
                  <span className="text-slate-300">{navMetrics.ssl.toFixed(0)}ms</span>
                </div>
                <div className="flex justify-between border-b border-slate-900/50 pb-0.5">
                  <span>서버 대기 (TTFB):</span>
                  <span className={cn("font-bold", navMetrics.ttfb > 500 ? "text-red-400" : "text-emerald-400")}>
                    {navMetrics.ttfb.toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between col-span-2 pt-1.5 mt-0.5 border-t border-slate-800">
                  <span className="font-sans font-bold text-slate-300">총 초기 렌더링 소요 시간:</span>
                  <span className="text-blue-400 font-extrabold text-[11px]">{navMetrics.total.toFixed(0)}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex px-3 py-2 bg-slate-900/10 gap-1 overflow-x-auto border-b border-slate-900 shrink-0">
            {(['all', 'server', 'client', 'auth', 'api'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-bold rounded-lg capitalize transition-all cursor-pointer whitespace-nowrap",
                  activeFilter === tab
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                )}
              >
                {tab === 'all' ? '전체' : tab === 'server' ? '서버' : tab === 'client' ? '클라이언트' : tab === 'auth' ? '인증' : 'API'}
              </button>
            ))}
          </div>

          {/* Logs List */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[150px] max-h-[300px] bg-slate-950/40">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-600 text-xs">
                <AlertCircle className="w-5 h-5 mb-1 text-slate-700" />
                <span>기록된 로딩 작업이 없습니다.</span>
              </div>
            ) : (
              [...filteredLogs].reverse().map((log) => {
                const isSlow = log.duration > 500;
                const isModerate = log.duration > 150 && log.duration <= 500;
                const durationColor = isSlow
                  ? "text-red-400"
                  : isModerate
                  ? "text-amber-400"
                  : "text-emerald-400";
                
                return (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase shrink-0",
                        log.type === 'server'
                          ? "bg-blue-950 text-blue-400 border border-blue-900"
                          : log.type === 'client'
                          ? "bg-purple-950 text-purple-400 border border-purple-900"
                          : log.type === 'auth'
                          ? "bg-orange-950 text-orange-400 border border-orange-900"
                          : "bg-emerald-950 text-emerald-400 border border-emerald-900"
                      )}>
                        {log.type === 'server' ? '서버' : log.type === 'client' ? '클라' : log.type === 'auth' ? '인증' : 'API'}
                      </span>
                      <span className="font-medium text-slate-300 truncate" title={log.label}>
                        {log.label}
                      </span>
                    </div>
                    <span className={cn("font-extrabold tabular-nums shrink-0", durationColor)}>
                      {log.duration.toFixed(1)}ms
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer warning message */}
          {stats.total > 500 && (
            <div className="px-4 py-2 border-t border-slate-900 bg-red-950/20 text-[10px] text-red-400 font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>로딩 시간이 500ms를 초과해 지연이 느껴질 수 있습니다.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
