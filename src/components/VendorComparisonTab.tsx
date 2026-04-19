import React, { useMemo, useState } from 'react';
import { Entry, Vendor } from '../types';
import { formatCurrency } from '../lib/utils';
import { getAvailablePeriods } from '../lib/dataUtils';
import { FileText, ArrowRightLeft, TrendingUp, TrendingDown, GitCompare, FileSpreadsheet, Download, Calendar } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { cn } from '../lib/utils';

interface Props {
  entries: Entry[];
  vendors: Vendor[];
}

export default function VendorComparisonTab({ entries, vendors }: Props) {
  const periods = useMemo(() => getAvailablePeriods(entries), [entries]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0] || '');
  const [filterMode, setFilterMode] = useState<'period' | 'range'>('period');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const comparisonData = useMemo(() => {
    let filteredEntries = entries;
    if (filterMode === 'period') {
      if (!selectedPeriod) return [];
      filteredEntries = entries.filter(e => e.periodName === selectedPeriod);
    } else {
      filteredEntries = entries.filter(e => e.date >= startDate && e.date <= endDate);
    }

    if (filteredEntries.length === 0) return [];
    
    const products = Array.from(new Set(filteredEntries.map(e => e.productName))).sort();

    return products.map(product => {
      const productEntries = filteredEntries.filter(e => e.productName === product);
      const vendorPrices: Record<string, { price: number; count: number; totalAmt: number }> = {};

      productEntries.forEach(e => {
        const vId = e.vendorId || 'unknown';
        if (!vendorPrices[vId]) {
          vendorPrices[vId] = { price: e.price, count: 0, totalAmt: 0 };
        }
        vendorPrices[vId].count += e.quantity;
        vendorPrices[vId].totalAmt += e.subtotal;
        vendorPrices[vId].price = vendorPrices[vId].totalAmt / vendorPrices[vId].count;
      });

      const prices = Object.values(vendorPrices).map(v => v.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      return {
        product,
        unit: productEntries[0].unit,
        vendorPrices,
        minPrice,
        maxPrice,
        avgPrice,
        spread: maxPrice - minPrice,
        spreadPercent: minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0
      };
    }).sort((a, b) => b.spreadPercent - a.spreadPercent); // Sort by biggest price difference
  }, [entries, selectedPeriod, filterMode, startDate, endDate]);

  const exportComparisonReport = async () => {
    if (comparisonData.length === 0) return;

    // Advanced analytics for the report
    const maxSpreadItem = [...comparisonData].sort((a, b) => b.spread - a.spread)[0];
    
    // Monthly savings potential
    let monthlyPotentialSavings = 0;
    const vendorWinCount: Record<string, number> = {};
    vendors.forEach(v => vendorWinCount[v.id] = 0);

    comparisonData.forEach(item => {
      vendors.forEach(v => {
        const vData = item.vendorPrices[v.id];
        if (vData) {
          if (vData.price === item.minPrice) {
            vendorWinCount[v.id]++;
          }
          monthlyPotentialSavings += (vData.totalAmt - (item.minPrice * vData.count));
        }
      });
    });

    // Annual potential savings logic
    const calcYear = filterMode === 'period' ? selectedPeriod.split('年')[0] : startDate.split('-')[0];
    const annualEntries = entries.filter(e => e.periodName.startsWith(calcYear));
    const annualProducts = Array.from(new Set(annualEntries.map(e => e.productName)));
    let annualPotentialSavings = 0;

    annualProducts.forEach(product => {
      const pEntries = annualEntries.filter(e => e.productName === product);
      const periodsInYear = Array.from(new Set(pEntries.map(e => e.periodName)));
      
      periodsInYear.forEach(p => {
        const periodPEntries = pEntries.filter(e => e.periodName === p);
        const vPrices = Array.from(new Set(periodPEntries.map(e => e.price)));
        const minP = Math.min(...vPrices);
        
        periodPEntries.forEach(e => {
          annualPotentialSavings += (e.subtotal - (minP * e.quantity));
        });
      });
    });

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ shading: { fill: "f1f5f9" }, children: [new Paragraph({ children: [new TextRun({ text: "商品名称", bold: true, size: 20 })], alignment: AlignmentType.CENTER })] }),
          ...vendors.map(v => (
            new TableCell({ shading: { fill: "f1f5f9" }, children: [new Paragraph({ children: [new TextRun({ text: v.name, bold: true, size: 20 })], alignment: AlignmentType.CENTER })] })
          )),
          new TableCell({ shading: { fill: "fef2f2" }, children: [new Paragraph({ children: [new TextRun({ text: "价差(%)", bold: true, size: 20 })], alignment: AlignmentType.CENTER })] }),
        ]
      })
    ];

    comparisonData.forEach(item => {
      tableRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: item.product, alignment: AlignmentType.CENTER })] }),
          ...vendors.map(v => {
            const vData = item.vendorPrices[v.id];
            const isMin = vData && vData.price === item.minPrice;
            return new TableCell({ 
              shading: isMin ? { fill: "f0fdf4" } : undefined,
              children: [new Paragraph({ 
                children: [new TextRun({ text: vData ? vData.price.toFixed(1) : "-", bold: isMin, color: isMin ? "16a34a" : "000000" })], 
                alignment: AlignmentType.CENTER 
              })] 
            });
          }),
          new TableCell({ 
            children: [new Paragraph({ 
              children: [new TextRun({ text: `${item.spreadPercent.toFixed(1)}%`, bold: item.spreadPercent > 10, color: item.spreadPercent > 10 ? "ef4444" : "000000" })], 
              alignment: AlignmentType.CENTER 
            })] 
          }),
        ]
      }));
    });

    const currentPeriodInfo = filterMode === 'period' ? selectedPeriod : `${startDate} 至 ${endDate}`;
    const currentYear = filterMode === 'period' ? selectedPeriod.split('年')[0] : startDate.split('-')[0];

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: `${currentPeriodInfo} 供应商横向采购价格审计报告`, bold: true, size: 32 })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }),
          
          new Paragraph({ children: [new TextRun({ text: "一、 执行摘要与总结", bold: true, size: 26 })], spacing: { before: 200, after: 100 } }),
          new Paragraph({ text: `本报告对 ${currentPeriodInfo} 期间 ${comparisonData.length} 种食材的跨供应商价格进行了深度穿透分析。通过建立比价模型发现，各供应商在不同品类上呈现出明显的竞争性价格差异。` }),
          
          new Paragraph({ children: [new TextRun({ text: "二、 供应商价格优势分析", bold: true, size: 26 })], spacing: { before: 400, after: 100 } }),
          ...vendors.map(v => (
            new Paragraph({ 
              bullet: { level: 0 },
              children: [
                new TextRun({ text: `${v.name}：`, bold: true }),
                new TextRun({ text: `在本月对比的 ${comparisonData.length} 项商品中，共有 ` }),
                new TextRun({ text: `${vendorWinCount[v.id]}`, bold: true, color: "2563eb" }),
                new TextRun({ text: " 项商品具备全场最低价优势。" })
              ]
            })
          )),

          new Paragraph({ children: [new TextRun({ text: "三、 经济效益与成本差额分析", bold: true, size: 26 })], spacing: { before: 400, after: 100 } }),
          new Paragraph({ 
            children: [
              new TextRun({ text: "1. 本月潜在节支总额：", bold: true }),
              new TextRun({ text: `若当前周期全部执行最低价采购策略，预计可额外节省支出 ` }),
              new TextRun({ text: `¥ ${formatCurrency(monthlyPotentialSavings)}`, bold: true, color: "16a34a" }),
              new TextRun({ text: " 元。" })
            ]
          }),
          new Paragraph({ 
            children: [
              new TextRun({ text: "2. 年度累计成本差额（预估）：", bold: true }),
              new TextRun({ text: `截至当前周期，${currentYear}年累计因价格偏差产生的节支空间为 ` }),
              new TextRun({ text: `¥ ${formatCurrency(annualPotentialSavings)}`, bold: true, color: "16a34a" }),
              new TextRun({ text: " 元。" })
            ]
          }),

          new Paragraph({ children: [new TextRun({ text: "四、 异常预警：最大价差商品", bold: true, size: 26 })], spacing: { before: 400, after: 100 } }),
          new Paragraph({ 
            children: [
              new TextRun({ text: "本期价格偏离度最高的商品为 " }),
              new TextRun({ text: `【${maxSpreadItem.product}】`, bold: true, color: "ef4444" }),
              new TextRun({ text: `，其跨供应商价差比例达到 ` }),
              new TextRun({ text: `${maxSpreadItem.spreadPercent.toFixed(1)}%`, bold: true }),
              new TextRun({ text: ` (绝对金额差: ¥${maxSpreadItem.spread.toFixed(1)} /每单位)，需重点关注其品质差异或供应商报价策略。` })
            ]
          }),

          new Paragraph({ children: [new TextRun({ text: "五、 详细比价对照表", bold: true, size: 26 })], spacing: { before: 400, after: 200 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }),
          
          new Paragraph({ children: [new TextRun({ text: "六、 审计建议", bold: true, size: 26 })], spacing: { before: 600, after: 100 } }),
          new Paragraph({ text: "  1. 依据本报告中的价格分布，建议在后续采购中优先将优势品类分配给对应的低价供应商。" }),
          new Paragraph({ text: "  2. 针对差价商品，应进行抽检比质，排除以次充好的价格陷阱。" }),
          new Paragraph({ children: [new TextRun({ text: `分析报告导出日期: ${new Date().toLocaleDateString('zh-CN')}` })], alignment: AlignmentType.RIGHT, spacing: { before: 800 } })
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${selectedPeriod}_供应商价格分析报告.docx`);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">供应商横向价格对比</h1>
          <p className="text-sm text-slate-500">同步分析多个供应商在相近周期内的报价，挖掘最优成本方案</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-white border border-slate-200 rounded-lg p-1 flex">
             <button 
               onClick={() => setFilterMode('period')}
               className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'period' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"}`}
             >
               按对账周期
             </button>
             <button 
               onClick={() => setFilterMode('range')}
               className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'range' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-900"}`}
             >
               按时间范围
             </button>
           </div>

           {filterMode === 'period' ? (
             <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center gap-3 shadow-sm min-w-[180px]">
               <Calendar className="w-4 h-4 text-slate-400" />
               <select 
                 value={selectedPeriod} 
                 onChange={e => setSelectedPeriod(e.target.value)}
                 className="text-sm font-bold text-slate-700 focus:outline-none bg-transparent w-full"
               >
                 {periods.filter(Boolean).map(p => (
                   <option key={`period-${p}`} value={p}>{p}</option>
                 ))}
                 {periods.filter(Boolean).length === 0 && <option key="no-period" value="">暂无对账周期</option>}
               </select>
             </div>
           ) : (
             <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 px-3 shadow-sm">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)}
                  className="text-sm font-bold text-slate-700 focus:outline-none bg-transparent py-1.5"
                />
                <span className="text-slate-300 font-bold">-</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)}
                  className="text-sm font-bold text-slate-700 focus:outline-none bg-transparent py-1.5"
                />
             </div>
           )}

           <button 
            onClick={exportComparisonReport}
            className="flex items-center gap-2 bg-blue-600 text-slate-950 px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            disabled={comparisonData.length === 0}
           >
             <Download className="w-4 h-4" />
             生成 Word 分析报告
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">对比覆盖率</span>
            <div className="flex items-end gap-2">
               <span className="text-4xl font-display font-bold text-emerald-700">{comparisonData.length}</span>
               <span className="text-sm text-emerald-500 mb-1.5 font-bold">种商品</span>
            </div>
         </div>
         <div className="bg-red-50 rounded-2xl p-6 border border-red-100 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">价格异动项</span>
            <div className="flex items-end gap-2">
               <span className="text-4xl font-display font-bold text-red-700">{comparisonData.filter(i => i.spreadPercent > 10).length}</span>
               <span className="text-sm text-red-500 mb-1.5 font-bold">项差异 &gt; 10%</span>
            </div>
         </div>
         <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col justify-between shadow-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">月度供应商活跃度</span>
            <div className="flex items-center gap-1">
               {vendors.map((v, idx) => (
                  <div key={v.id} className="w-2.4 h-8 bg-blue-500 rounded-sm opacity-60 hover:opacity-100 transition-opacity" style={{ opacity: 0.2 + (idx * 0.2) }} title={v.name}></div>
               ))}
               <span className="text-white font-bold ml-2">{vendors.length} 家供应商参与</span>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center font-bold text-slate-900">
           <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
              <span>商品价格横向分布表 ({filterMode === 'period' ? `对账周期: ${selectedPeriod}` : `时间范围: ${startDate} 至 ${endDate}`})</span>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[800px]">
             <thead>
               <tr className="bg-slate-50 border-b border-slate-100">
                 <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] sticky left-0 bg-slate-50 z-20">商品名称 (单位)</th>
                 {vendors.map(v => (
                   <th key={v.id} className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px] text-center border-l border-slate-100">{v.name}</th>
                 ))}
                 <th className="px-6 py-4 font-bold text-red-500 uppercase tracking-widest text-[10px] text-center border-l border-slate-100">价差幅度</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
                {comparisonData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-50">
                      <div className="font-bold text-slate-900">{item.product}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{item.unit}</div>
                    </td>
                    {vendors.map(v => {
                       const vData = item.vendorPrices[v.id];
                       const isMin = vData && vData.price === item.minPrice && vendors.length > 1;
                       return (
                         <td key={v.id} className={cn("px-6 py-4 text-center border-l border-slate-50", isMin && "bg-emerald-50")}>
                           {vData ? (
                             <div className="flex flex-col items-center">
                                <span className={cn("font-bold text-sm", isMin ? "text-emerald-600" : "text-slate-700")}>¥{vData.price.toFixed(1)}</span>
                                <span className="text-[9px] text-slate-400 mt-0.5">均价</span>
                             </div>
                           ) : (
                             <span className="text-slate-300 font-medium">--</span>
                           )}
                         </td>
                       );
                    })}
                    <td className="px-6 py-4 text-center border-l border-slate-100 bg-slate-50/30">
                       <div className="flex flex-col items-center">
                          <div className={cn("font-black text-sm", item.spreadPercent > 10 ? "text-red-500" : "text-slate-400")}>
                             {item.spreadPercent.toFixed(1)}%
                          </div>
                          {item.spreadPercent > 10 && <TrendingUp className="w-3 h-3 text-red-400 mt-1" />}
                       </div>
                    </td>
                  </tr>
                ))}
                {comparisonData.length === 0 && (
                   <tr>
                     <td colSpan={vendors.length + 2} className="px-6 py-12 text-center text-slate-400 italic">
                        该周期内暂无足够的采购记录进行跨供应商对比。请在“单据录入”中确保选择了不同的供应商。
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
