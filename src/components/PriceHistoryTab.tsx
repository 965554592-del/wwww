import React, { useState, useMemo } from 'react';
import { PriceRecord } from '../types';
import { formatCurrency } from '../lib/utils';
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp, TrendingDown, AlertTriangle, Info, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PriceHistoryTabProps {
  records: PriceRecord[];
}

export default function PriceHistoryTab({ records }: PriceHistoryTabProps) {
  const periods = useMemo(() => {
    return Array.from(new Set(records.map(r => r.periodName))).sort().reverse();
  }, [records]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0] || '');

  React.useEffect(() => {
    if (periods.length > 0 && !periods.includes(selectedPeriod) && selectedPeriod !== '') {
      setSelectedPeriod(periods[0]);
    }
  }, [periods, selectedPeriod]);

  const filteredRecords = useMemo(() => {
    if (!selectedPeriod) return records;
    return records.filter(r => r.periodName === selectedPeriod);
  }, [records, selectedPeriod]);

  // Summary statistics
  const summary = useMemo(() => {
    let increaseCount = 0;
    let decreaseCount = 0;
    let maxIncrease: PriceRecord | null = null;
    let maxDecrease: PriceRecord | null = null;

    filteredRecords.forEach(record => {
      const diff = record.difference;
      if (diff === null || diff === 0) return;

      if (diff > 0) {
        increaseCount++;
        if (!maxIncrease || diff > (maxIncrease.difference || 0)) {
          maxIncrease = record;
        }
      } else if (diff < 0) {
        decreaseCount++;
        if (!maxDecrease || diff < (maxDecrease.difference || 0)) {
          maxDecrease = record;
        }
      }
    });

    return { increaseCount, decreaseCount, maxIncrease, maxDecrease };
  }, [filteredRecords]);

  const exportToExcel = () => {
    const wsData: any[][] = [
      ['价格变动分析明细'],
      [`分析周期: ${selectedPeriod || '全部历史记录'}`],
      [],
      ['周期分析总结', ''],
      [`涨价商品数: ${summary.increaseCount} 种`, `降价商品数: ${summary.decreaseCount} 种`]
    ];

    if (summary.maxIncrease) {
      wsData.push([
        `最大涨幅商品: ${summary.maxIncrease.productName}`, 
        `涨跌额: +${formatCurrency(summary.maxIncrease.difference!)}元 (当前单价: ${formatCurrency(summary.maxIncrease.price)}元)`
      ]);
    } else {
      wsData.push(['最大涨幅商品: 无涨价记录', '']);
    }

    if (summary.maxDecrease) {
      wsData.push([
        `最大降幅商品: ${summary.maxDecrease.productName}`, 
        `涨跌额: ${formatCurrency(summary.maxDecrease.difference!)}元 (当前单价: ${formatCurrency(summary.maxDecrease.price)}元)`
      ]);
    } else {
      wsData.push(['最大降幅商品: 无降价记录', '']);
    }

    wsData.push([]);
    wsData.push(['对账周期', '录入日期', '商品名称', '上次单价(元)', '本次单价(元)', '单价差额(元)']);

    filteredRecords.forEach(record => {
      wsData.push([
        record.periodName,
        record.date,
        record.productName,
        record.prevPrice !== null ? record.prevPrice : '-',
        record.price,
        record.difference !== null ? record.difference : '-'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
      { s: { r: 4, c: 3 }, e: { r: 4, c: 5 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
      { s: { r: 5, c: 3 }, e: { r: 5, c: 5 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
      { s: { r: 6, c: 3 }, e: { r: 6, c: 5 } },
    ];

    // Add some styling hints (note: standard xlsx doesn't fully support styling without pro version, but merges help structure)
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "价格变动记录");

    XLSX.writeFile(wb, `价格变化明细_${selectedPeriod || '全部历史'}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-[1.5rem] font-bold text-[#1e293b] leading-tight">价格变化分析</h1>
          <p className="text-sm text-[#64748b] mt-1">对比同一商品在当前周期的价格波动</p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={exportToExcel}
            className="flex items-center space-x-2 bg-white border border-[#e2e8f0] px-4 py-1.5 rounded-md text-sm font-medium text-[#1e293b] hover:bg-[#f8fafc] transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-[#2563eb]" />
            <span>导出明细</span>
          </button>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-[#64748b]">筛选对账周期:</label>
            <select 
              value={selectedPeriod} 
              onChange={e => setSelectedPeriod(e.target.value)}
              className="rounded-md border border-[#e2e8f0] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] bg-white font-medium"
            >
              <option value="">全部历史记录</option>
              {periods.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col justify-between">
          <div className="text-sm text-[#64748b] mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4 text-[#ef4444]" /> 涨价商品数</div>
          <div className="text-[1.75rem] font-bold text-[#1e293b]">{summary.increaseCount} <span className="text-sm font-normal text-[#64748b]">种</span></div>
        </div>
        
        <div className="bg-white p-5 rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col justify-between">
          <div className="text-sm text-[#64748b] mb-2 flex items-center gap-1"><TrendingDown className="w-4 h-4 text-[#10b981]" /> 降价商品数</div>
          <div className="text-[1.75rem] font-bold text-[#1e293b]">{summary.decreaseCount} <span className="text-sm font-normal text-[#64748b]">种</span></div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col justify-between">
          <div className="text-sm text-[#64748b] mb-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-[#ef4444]" /> 最大涨幅商品</div>
          {summary.maxIncrease ? (
            <div>
              <div className="text-lg font-bold text-[#1e293b] truncate" title={summary.maxIncrease.productName}>{summary.maxIncrease.productName}</div>
              <div className="text-sm text-[#ef4444] font-medium mt-1">+{formatCurrency(summary.maxIncrease.difference!)}元 ({formatCurrency(summary.maxIncrease.price)}元)</div>
            </div>
          ) : (
            <div className="text-base text-[#94a3b8] mt-1">无涨价记录</div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col justify-between">
          <div className="text-sm text-[#64748b] mb-2 flex items-center gap-1"><Info className="w-4 h-4 text-[#10b981]" /> 最大降幅商品</div>
          {summary.maxDecrease ? (
            <div>
              <div className="text-lg font-bold text-[#1e293b] truncate" title={summary.maxDecrease.productName}>{summary.maxDecrease.productName}</div>
              <div className="text-sm text-[#10b981] font-medium mt-1">{formatCurrency(summary.maxDecrease.difference!)}元 ({formatCurrency(summary.maxDecrease.price)}元)</div>
            </div>
          ) : (
            <div className="text-base text-[#94a3b8] mt-1">无降价记录</div>
          )}
        </div>
      </section>

      <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex justify-between items-center">
          <h2 className="text-base font-semibold text-[#1e293b]">价格变动明细</h2>
          <span className="text-xs text-[#64748b]">筛选出 {filteredRecords.length} 条记录</span>
        </div>
        
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#f8fafc]">
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc]">对账周期</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc]">录入日期</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc]">商品名称</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-right">上次单价(元)</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-right">本次单价(元)</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-right">差价</th>
              </tr>
            </thead>
            <tbody className="text-[#1e293b]">
              {filteredRecords.map(record => {
                const hasDiff = record.difference !== null && record.difference !== 0;
                const isIncrease = record.difference !== null && record.difference > 0;
                const isDecrease = record.difference !== null && record.difference < 0;
                const diffClass = isIncrease ? 'text-[#ef4444] font-bold' : isDecrease ? 'text-[#10b981] font-bold' : 'text-[#64748b]';
                
                return (
                  <tr key={record.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] text-sm transition-colors">
                    <td className="px-5 py-3 text-[#64748b]"><span className="bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded text-xs px-3">{record.periodName}</span></td>
                    <td className="px-5 py-3 text-[#64748b]">{record.date}</td>
                    <td className="px-5 py-3 font-medium text-[#1e293b]">{record.productName}</td>
                    <td className="px-5 py-3 text-[#64748b] text-right">
                      {record.prevPrice !== null ? formatCurrency(record.prevPrice) : '-'}
                    </td>
                    <td className="px-5 py-3 text-[#1e293b] text-right font-medium">
                      {formatCurrency(record.price)}
                    </td>
                    <td className={`px-5 py-3 text-right flex items-center justify-end ${diffClass}`}>
                      {record.difference !== null ? (
                        <>
                          {isIncrease && <ArrowUpRight className="w-4 h-4 mr-1 text-[#ef4444]" />}
                          {isDecrease && <ArrowDownRight className="w-4 h-4 mr-1 text-[#10b981]" />}
                          {record.difference === 0 && <Minus className="w-4 h-4 mr-1 text-[#94a3b8]" />}
                          <span>{record.difference > 0 ? '+' : ''}{formatCurrency(record.difference)}</span>
                        </>
                      ) : (
                        <span className="text-[#94a3b8]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748b]">暂无价格变动记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
