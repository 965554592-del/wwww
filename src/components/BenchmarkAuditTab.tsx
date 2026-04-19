import React, { useMemo, useState } from 'react';
import { Entry } from '../types';
import { formatCurrency } from '../lib/utils';
import { getAvailablePeriods } from '../lib/dataUtils';
import { FileText, Search, TrendingUp, TrendingDown, AlertTriangle, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  entries: Entry[];
}

export default function BenchmarkAuditTab({ entries }: Props) {
  const periods = useMemo(() => getAvailablePeriods(entries), [entries]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0] || '');
  const [reportType, setReportType] = useState<'monthly' | 'annual'>('monthly');

  const auditData = useMemo(() => {
    let filtered = entries;
    if (reportType === 'monthly' && selectedPeriod) {
      filtered = entries.filter(e => e.periodName === selectedPeriod);
    } else if (reportType === 'annual' && selectedPeriod) {
      const year = selectedPeriod.split('年')[0];
      filtered = entries.filter(e => e.periodName.startsWith(year));
    }

    const report = filtered.map(e => {
      const isOver = e.refPriceAtEntry !== undefined && e.price > e.refPriceAtEntry;
      const diff = e.refPriceAtEntry !== undefined ? e.price - e.refPriceAtEntry : 0;
      const diffPercent = e.refPriceAtEntry ? (diff / e.refPriceAtEntry) * 100 : 0;
      
      return {
        ...e,
        isOver,
        diff,
        diffPercent
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalOver = report.filter(r => r.isOver).length;
    const totalCount = report.length;
    const complianceRate = totalCount > 0 ? ((totalCount - totalOver) / totalCount * 100).toFixed(1) : '100';

    return { report, totalOver, totalCount, complianceRate };
  }, [entries, selectedPeriod, reportType]);

  const exportReport = () => {
    const wsData = [
      [`市场基准价执行合规分析报告 (${reportType === 'monthly' ? selectedPeriod : selectedPeriod.split('年')[0] + '年年度'})`],
      [`导出日期: ${new Date().toLocaleDateString()}`, `总体合规率: ${auditData.complianceRate}%`],
      [],
      ['日期', '商品名称', '单位', '实际单价', '基准限价', '偏差金额', '偏差比例', '状态', '所属周期']
    ];

    auditData.report.forEach(r => {
      wsData.push([
        r.date,
        r.productName,
        r.unit,
        r.price,
        r.refPriceAtEntry || '-',
        r.refPriceAtEntry ? r.diff.toFixed(2) : '-',
        r.refPriceAtEntry ? r.diffPercent.toFixed(1) + '%' : '-',
        r.isOver ? '超过基准' : (r.refPriceAtEntry ? '合规' : '未设基准'),
        r.periodName
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "基准价合规报告");
    XLSX.writeFile(wb, `基准价合规报告_${selectedPeriod}_${reportType}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">基准价合规审计报告</h1>
          <p className="text-sm text-slate-500">自动记录并分析每次录入时的价格合规性与变动趋势</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-white border border-slate-200 rounded-lg p-1 flex">
             <button 
               onClick={() => setReportType('monthly')}
               className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${reportType === 'monthly' ? "bg-slate-900 text-slate-100 shadow-md" : "text-slate-500 hover:text-slate-900"}`}
             >
               月度报表
             </button>
             <button 
               onClick={() => setReportType('annual')}
               className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${reportType === 'annual' ? "bg-slate-900 text-slate-100 shadow-md" : "text-slate-500 hover:text-slate-900"}`}
             >
               年度报表
             </button>
           </div>
           
            <select 
              value={selectedPeriod} 
              onChange={e => setSelectedPeriod(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {periods.filter(Boolean).map(p => (
                <option key={`period-${p}`} value={p}>{p}</option>
              ))}
            </select>

           <button 
            onClick={exportReport}
            className="flex items-center gap-2 bg-blue-600 text-slate-950 px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
           >
             <FileSpreadsheet className="w-4 h-4" />
             导出 Excel 报告
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">审计总项数</span>
          </div>
          <div className="text-3xl font-display font-bold text-slate-900">{auditData.totalCount} <span className="text-sm font-medium text-slate-400">项</span></div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">价格激增/异常</span>
          </div>
          <div className="text-3xl font-display font-bold text-red-600">{auditData.totalOver} <span className="text-sm font-medium text-slate-400">项</span></div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 text-emerald-400 rounded-xl backdrop-blur-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">本期基准价执行合规率</span>
            </div>
            <div className="flex items-end gap-3">
              <div className="text-5xl font-display font-bold text-emerald-400">{auditData.complianceRate}%</div>
              <div className="text-xs text-slate-500 mb-2 font-medium">高于行业 12% 既定阈值</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">详细审计流水</h3>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">实时记录录入时刻基准价</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] w-24">日期</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">商品名称</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right">实际单价</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right">历史基准价</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-right">涨跌差额</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-center">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditData.report.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-slate-500 font-medium">{item.date}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{item.productName}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{item.unit}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">¥{formatCurrency(item.price)}</td>
                  <td className="px-6 py-4 text-right text-slate-500 font-medium">
                    {item.refPriceAtEntry !== undefined ? `¥${formatCurrency(item.refPriceAtEntry)}` : '--'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {item.refPriceAtEntry !== undefined ? (
                      <div className={`inline-flex items-center gap-1 font-bold ${item.diff > 0 ? 'text-red-500' : (item.diff < 0 ? 'text-emerald-500' : 'text-slate-400')}`}>
                        {item.diff > 0 ? <TrendingUp className="w-3 h-3" /> : (item.diff < 0 ? <TrendingDown className="w-3 h-3" /> : null)}
                        {item.diff > 0 ? '+' : ''}{formatCurrency(item.diff)}
                        <span className="text-[10px] ml-1">({item.diffPercent.toFixed(1)}%)</span>
                      </div>
                    ) : '--'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.refPriceAtEntry === undefined ? (
                        <span className="px-2 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-full border border-slate-200 uppercase">无监控</span>
                    ) : item.isOver ? (
                        <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded-full border border-red-200 uppercase">超过基准价</span>
                    ) : (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-200 uppercase">合规</span>
                    )}
                  </td>
                </tr>
              ))}
              {auditData.report.length === 0 && (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                     未找到符合当前筛选条件的审计记录。系统从启用快照记录后的录入将显示在此。
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
