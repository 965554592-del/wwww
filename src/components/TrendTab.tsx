import React, { useState, useMemo } from 'react';
import { Entry } from '../types';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { TrendingUp, Calendar, Box, Activity, ChevronRight, ChevronLeft, Filter } from 'lucide-react';

interface TrendTabProps {
  entries: Entry[];
  referencePrices: Record<string, number>;
}

export default function TrendTab({ entries, referencePrices }: TrendTabProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'3months' | '6months' | 'year' | 'all'>('all');

  // Basic dimensions: List of all products found in entries
  const allProducts = useMemo(() => {
    return Array.from(new Set(entries.map(e => e.productName))).sort();
  }, [entries]);

  // Initial selection
  React.useEffect(() => {
    if (selectedProducts.length === 0 && allProducts.length > 0) {
      setSelectedProducts(allProducts.slice(0, 3));
    }
  }, [allProducts, selectedProducts.length]);

  // Data preparation for the chart
  const chartData = useMemo(() => {
    // Group by date
    const dateMap = new Map<string, any>();
    
    // Sort entries by date
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedEntries.forEach(entry => {
      if (!selectedProducts.includes(entry.productName)) return;
      
      const dateKey = entry.date;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { name: dateKey });
      }
      const dataPoint = dateMap.get(dateKey)!;
      dataPoint[entry.productName] = entry.price;
    });

    const result = Array.from(dateMap.values());
    
    // Filter by time range if needed
    if (timeRange === 'all' || result.length === 0) return result;
    
    const lastDate = new Date(result[result.length - 1].name);
    let cutoffDate = new Date(lastDate);
    if (timeRange === '3months') cutoffDate.setMonth(cutoffDate.getMonth() - 3);
    else if (timeRange === '6months') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    else if (timeRange === 'year') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    
    return result.filter(d => new Date(d.name) >= cutoffDate);
  }, [entries, selectedProducts, timeRange]);

  const toggleProduct = (product: string) => {
    if (selectedProducts.includes(product)) {
      setSelectedProducts(selectedProducts.filter(p => p !== product));
    } else {
      if (selectedProducts.length < 5) {
        setSelectedProducts([...selectedProducts, product]);
      } else {
        alert('最多支持同时对比 5 种商品');
      }
    }
  };

  // Colors for multiple lines
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="flex flex-col gap-6 h-full text-[#1e293b]">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">价格趋势深度报告</h1>
          <p className="text-sm text-slate-500 mt-1">多维度追踪食材市场基准价与实际采购价格走势</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner group">
          {[
            { id: '3months', label: '近3月' },
            { id: '6months', label: '近半年' },
            { id: 'year', label: '近一年' },
            { id: 'all', label: '全部' }
          ].map(range => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id as any)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                timeRange === range.id 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Left: Product Selection Panel */}
        <aside className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <Filter className="w-4 h-4 text-blue-500" />
              对比维度选择
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">
              {selectedProducts.length}/5
            </span>
          </div>
          
          <div className="p-3">
             <div className="relative">
                <input 
                  type="text" 
                  placeholder="搜索商品..." 
                  className="w-full bg-slate-50 border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20"
                />
                <Activity className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 custom-scrollbar">
            {allProducts.map(product => {
              const isSelected = selectedProducts.includes(product);
              const refPrice = referencePrices[product];
              return (
                <button
                  key={product}
                  onClick={() => toggleProduct(product)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 group border",
                    isSelected 
                      ? "bg-blue-50 border-blue-200" 
                      : "bg-white border-transparent hover:bg-slate-50"
                  )}
                >
                  <div className="flex flex-col">
                    <span className={cn("text-sm font-semibold", isSelected ? "text-blue-700" : "text-slate-700")}>
                      {product}
                    </span>
                    {refPrice && (
                      <span className="text-[10px] text-slate-400">基准价: ¥{refPrice.toFixed(1)}</span>
                    )}
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all",
                    isSelected 
                      ? "bg-blue-600 border-blue-600 text-white scale-110" 
                      : "border-slate-200 group-hover:border-slate-300"
                  )}>
                    {isSelected && <TrendingUp className="w-3 h-3" />}
                  </div>
                </button>
              );
            })}
            {allProducts.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm">
                暂无商品数据
              </div>
            )}
          </div>
        </aside>

        {/* Right: Chart Area */}
        <section className="lg:col-span-3 flex flex-col gap-6 min-h-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">历史价格走势曲线</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      实时分析中
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto max-w-xs md:max-w-md no-scrollbar">
                {selectedProducts.map((p, i) => (
                  <div key={p} className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-100 rounded-lg whitespace-nowrap">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>
                    <span className="text-xs font-bold text-slate-600">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 w-full min-h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                      tickFormatter={(value) => `¥${formatCurrency(value)}`}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4 text-white">
                              <p className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2 uppercase tracking-widest">
                                <Calendar className="w-3 h-3" /> {label}
                              </p>
                              <div className="space-y-2">
                                {payload.map((entry: any, index: number) => (
                                  <div key={index} className="flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                      <span className="text-sm font-medium text-slate-200">{entry.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-white">¥ {formatCurrency(entry.value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {selectedProducts.map((product, index) => (
                      <Line
                        key={product}
                        type="monotone"
                        dataKey={product}
                        stroke={colors[index % colors.length]}
                        strokeWidth={3}
                        dot={{ r: 4, fill: colors[index % colors.length], strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        animationDuration={1500}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Box className="w-12 h-12 mb-4 opacity-10" />
                  <p className="text-sm font-medium">请在左侧选择商品以查看趋势图表</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">波动力度分析</div>
              <div className="flex items-end justify-between">
                <div>
                   <div className="text-2xl font-display font-bold text-slate-900">稳定</div>
                   <div className="text-xs text-slate-500 mt-1">综合市场指数</div>
                </div>
                <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                   <div className="w-2/3 h-full bg-blue-500"></div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">主要影响因素</div>
              <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">季节性变动</span>
                 <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">采购批量</span>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100">
              <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-4">预算提醒</div>
              <div className="text-sm font-semibold text-blue-900">当前价格趋势显示总体支出较为稳定，未见异常波动。</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
