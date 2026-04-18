import React, { useState, useMemo } from 'react';
import { Entry } from '../types';
import { getAvailablePeriods, computeInventory } from '../lib/dataUtils';
import { formatCurrency, cn, toChineseBig } from '../lib/utils';
import { FileText, Download, Search, LayoutGrid, List, Trophy, DollarSign, FileSpreadsheet, Package, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

type ViewMode = 'detail' | 'summary';

interface InventoryTabProps {
  entries: Entry[];
  reductionRate: number;
}

export default function InventoryTab({ entries, reductionRate }: InventoryTabProps) {
  const reductionMultiplier = useMemo(() => (100 - reductionRate) / 100, [reductionRate]);
  const periods = useMemo(() => getAvailablePeriods(entries), [entries]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0] || '');
  const [productSearch, setProductSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  // Keep selected period in sync if valid periods change and selected makes no sense
  React.useEffect(() => {
    if (periods.length > 0 && !periods.includes(selectedPeriod)) {
      setSelectedPeriod(periods[0]);
    } else if (periods.length === 0) {
      setSelectedPeriod('');
    }
  }, [periods, selectedPeriod]);

  const allRows = useMemo(() => computeInventory(entries, selectedPeriod), [entries, selectedPeriod]);

  const uniqueUnits = useMemo(() => {
    return Array.from(new Set(allRows.map(r => r.unit))).sort();
  }, [allRows]);

  const rows = useMemo(() => {
    return allRows.filter(row => {
      const matchName = row.productName.toLowerCase().includes(productSearch.toLowerCase());
      const matchUnit = unitFilter ? row.unit === unitFilter : true;
      return matchName && matchUnit;
    });
  }, [allRows, productSearch, unitFilter]);

  const { totalInQty, totalInAmt, totalOutQty, totalOutAmt } = useMemo(() => {
    let inQ = 0, inA = 0, outQ = 0, outA = 0;
    rows.forEach(r => {
      inQ += r.inQty;
      inA += r.inAmt;
      outQ += r.outQty;
      outA += r.outAmt;
    });
    return { totalInQty: inQ, totalInAmt: inA, totalOutQty: outQ, totalOutAmt: outA };
  }, [rows]);

  const invoiceAmount = totalInAmt * reductionMultiplier; // 开票金额下浮

  // Group by Product Name Summary
  const productSummaryRows = useMemo(() => {
    const summaryMap = new Map<string, {
      productName: string;
      unit: string;
      inQty: number;
      inAmt: number;
      outQty: number;
      outAmt: number;
    }>();

    allRows.forEach(row => {
      if (!summaryMap.has(row.productName)) {
        summaryMap.set(row.productName, {
          productName: row.productName,
          unit: row.unit,
          inQty: 0,
          inAmt: 0,
          outQty: 0,
          outAmt: 0
        });
      }
      const s = summaryMap.get(row.productName)!;
      s.inQty += row.inQty;
      s.inAmt += row.inAmt;
      s.outQty += row.outQty;
      s.outAmt += row.outAmt;
    });

    return Array.from(summaryMap.values())
      .filter(row => row.productName.toLowerCase().includes(productSearch.toLowerCase()))
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [allRows, productSearch]);

  const highlights = useMemo(() => {
    if (productSummaryRows.length === 0) return null;
    
    let maxQtyProduct = productSummaryRows[0];
    let maxAmtProduct = productSummaryRows[0];

    productSummaryRows.forEach(row => {
      if (row.inQty > maxQtyProduct.inQty) maxQtyProduct = row;
      if (row.inAmt > maxAmtProduct.inAmt) maxAmtProduct = row;
    });

    return { maxQtyProduct, maxAmtProduct };
  }, [productSummaryRows]);

  const exportToExcel = () => {
    const wsData = [
      ['采购对账及出入库统计表'],
      [`对账周期: ${selectedPeriod}`],
      [],
      ['序号', '商品名称', '单位', '上月结余', '', '本月入库', '', '', '本月出库', '', '本月结余', ''],
      ['', '', '', '数量', '金额', '数量', '单价', '金额', '数量', '金额', '数量', '金额'],
    ];

    rows.forEach((row, index) => {
      wsData.push([
        String(index + 1),
        row.productName,
        row.unit,
        row.prevBalanceQty,
        row.prevBalanceAmt,
        row.inQty,
        row.price,
        row.inAmt,
        row.outQty,
        row.outAmt,
        row.balanceQty,
        row.balanceAmt
      ]);
    });

    const totalRowIndex = wsData.length;
    wsData.push([
      '合计', '', '', '', '', '', '', totalInAmt, '', totalOutAmt, '', ''
    ]);

    // 添加签名位置 (保证在同一行)
    wsData.push([]);
    wsData.push([]);
    wsData.push([
      '部门主管：__________',
      '',
      '验收人：__________',
      '',
      '保管员：__________',
      '',
      '缴库人：__________',
      '',
      '领料人：__________'
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
      { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
      { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 3, c: 4 } },
      { s: { r: 3, c: 5 }, e: { r: 3, c: 7 } },
      { s: { r: 3, c: 8 }, e: { r: 3, c: 9 } },
      { s: { r: 3, c: 10 }, e: { r: 3, c: 11 } },
      { s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 2 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "出入库统计");

    XLSX.writeFile(wb, `出入库统计_${selectedPeriod}.xlsx`);
  };

  const exportPaymentPlan = async () => {
    if (!selectedPeriod) return;

    // Parse period to get date range
    // Format: "YYYY年MM月"
    const match = selectedPeriod.match(/(\d+)年(\d+)月/);
    if (!match) return;
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);

    let startYear = year;
    let startMonth = month - 1;
    if (startMonth === 0) {
      startMonth = 12;
      startYear -= 1;
    }
    
    const startDateStr = `${startYear}年${startMonth}月26日`;
    const endDateStr = `${year}年${month}月25日`;
    const totalAmountStr = totalInAmt.toFixed(2);
    const paidAmountStr = invoiceAmount.toFixed(2);
    const paidAmountBig = toChineseBig(invoiceAmount);

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `职工食堂 ${month} 月份采购及支付金额统计`,
                size: 32,
                bold: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 600 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "办公室、领导：",
                size: 28,
              }),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            indent: { firstLine: 480 },
            children: [
              new TextRun({ text: `${startYear} 年 ${startMonth} 月 26 日至 ${year} 年 ${month} 月 25 日，职工食堂采购物资共计 `, size: 28 }),
              new TextRun({ text: totalAmountStr, size: 28, bold: true }),
              new TextRun({ text: " 元（购物清单附后）。根据采购合同，折扣率为 ", size: 28 }),
              new TextRun({ text: `${reductionRate}%`, size: 28, bold: true }),
              new TextRun({ text: "，实际支付费用按 ", size: 28 }),
              new TextRun({ text: `${100 - reductionRate}%`, size: 28, bold: true }),
              new TextRun({ text: "计算，支付金额 ", size: 28 }),
              new TextRun({ text: paidAmountStr, size: 28, bold: true }),
              new TextRun({ text: ` 元（大写${paidAmountBig}）。请审核。`, size: 28 }),
            ],
            spacing: { before: 240, after: 800, line: 480, lineRule: "auto" },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "主管领导：", size: 28 }),
              new TextRun({ text: "\t\t\t\t\t", size: 28 }),
              new TextRun({ text: "办公室主任：", size: 28 }),
            ],
            spacing: { before: 800, after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "统计：", size: 28 }),
            ],
            spacing: { before: 400, after: 800 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${new Date().getFullYear()} 年 ${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日`, size: 28 }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `付款计划_${selectedPeriod}.docx`);
  };

  if (periods.length === 0) {
    return (
      <div className="bg-white p-12 rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] text-center flex flex-col items-center">
        <FileText className="w-12 h-12 text-[#64748b] mb-4" />
        <h2 className="text-lg font-medium text-[#1e293b] mb-2">暂无出入库数据</h2>
        <p className="text-sm text-[#64748b]">请先在「销货单录入」中添加记录</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <header className="flex justify-between items-end">
        <div>
          {selectedPeriod && (
            <span className="inline-block px-3 py-1 bg-[#dbeafe] text-[#2563eb] rounded-full text-sm font-semibold mb-1">
              {selectedPeriod}周期
            </span>
          )}
          <h1 className="text-[1.5rem] font-bold text-[#1e293b] leading-tight">出入库明细与对账统计</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={exportPaymentPlan}
            className="flex items-center space-x-2 bg-white border border-emerald-500 px-4 py-1.5 rounded-md text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors shadow-sm"
          >
            <FileText className="w-4 h-4 text-emerald-500" />
            <span>导出付款计划</span>
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center space-x-2 bg-white border border-[#e2e8f0] px-4 py-1.5 rounded-md text-sm font-medium text-[#1e293b] hover:bg-[#f8fafc] transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#2563eb]" />
            <span>导出 Excel</span>
          </button>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-[#64748b]">选择对账周期:</label>
            <select 
              value={selectedPeriod} 
              onChange={e => setSelectedPeriod(e.target.value)}
              className="rounded-md border border-[#e2e8f0] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] bg-white font-medium"
            >
              {periods.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="p-6 rounded-2xl bg-white shadow-sm border border-slate-200 hover:shadow-md transition-shadow group flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Package className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">本期采购总额</div>
          </div>
          <div className="text-3xl font-display font-bold text-slate-900 tracking-tight">¥ {formatCurrency(totalInAmt)}</div>
        </div>
        <div className="p-6 rounded-2xl bg-white shadow-sm border border-slate-200 hover:shadow-md transition-shadow group flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">本期消耗总额</div>
          </div>
          <div className="text-3xl font-display font-bold text-slate-900 tracking-tight">¥ {formatCurrency(totalOutAmt)}</div>
        </div>
        <div className="p-6 rounded-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] shadow-xl shadow-slate-200 border border-slate-800 text-white relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 text-blue-400 rounded-lg backdrop-blur-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider italic">开票金额 (下浮 {reductionRate}%)</div>
            </div>
            <div className="text-3xl font-display font-bold text-amber-400 tracking-tight">¥ {formatCurrency(invoiceAmount)}</div>
          </div>
        </div>
      </section>

      {/* Floating Summary Component */}
      <AnimatePresence>
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-1 flex items-center gap-1">
            {isSummaryExpanded ? (
              <motion.div 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex items-center gap-6 px-6 py-3 overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">入库总额</div>
                    <div className="text-lg font-display font-bold text-white leading-none whitespace-nowrap">¥ {formatCurrency(totalInAmt)}</div>
                  </div>
                </div>

                <div className="w-px h-8 bg-slate-800"></div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">下浮金额</div>
                    <div className="text-lg font-display font-bold text-emerald-400 leading-none whitespace-nowrap">¥ {formatCurrency(totalInAmt - invoiceAmount)}</div>
                  </div>
                </div>

                <div className="w-px h-8 bg-slate-800"></div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">应付总计</div>
                    <div className="text-lg font-display font-bold text-amber-500 leading-none whitespace-nowrap">¥ {formatCurrency(invoiceAmount)}</div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="px-6 py-4 flex items-center gap-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">数据汇总摘要</div>
                <div className="text-sm font-bold text-white">¥ {formatCurrency(totalInAmt)}</div>
              </div>
            )}
            
            <button 
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
            >
              {isSummaryExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <section className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-base font-semibold text-[#1e293b]">采购与库存统计</h2>
              <span className="text-xs text-[#64748b]">筛选出 {viewMode === 'detail' ? rows.length : productSummaryRows.length} 项数据</span>
            </div>
            <div className="flex bg-[#f1f5f9] p-1 rounded-lg ml-4">
              <button
                onClick={() => setViewMode('detail')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  viewMode === 'detail' ? "bg-white text-[#2563eb] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
                )}
              >
                <List className="w-4 h-4" />
                明细模式
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  viewMode === 'summary' ? "bg-white text-[#2563eb] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                汇总模式
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="搜索商品名称..." 
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 w-48 rounded-md border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-[#64748b]">筛选单位:</span>
              <select 
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                className="rounded-md border border-[#e2e8f0] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb] bg-white max-w-[120px]"
              >
                <option value="">全部</option>
                {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-auto flex-1">
          {viewMode === 'summary' && highlights && (
            <div className="px-5 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
                <Trophy className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">采购数量最多:</span>
                <span className="text-sm font-bold">{highlights.maxQtyProduct.productName}</span>
                <span className="text-xs text-orange-600 bg-orange-100 px-1.5 rounded">{highlights.maxQtyProduct.inQty} {highlights.maxQtyProduct.unit}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">采购金额最大:</span>
                <span className="text-sm font-bold">{highlights.maxAmtProduct.productName}</span>
                <span className="text-sm text-blue-600 font-extrabold">¥{highlights.maxAmtProduct.inAmt.toLocaleString()}</span>
              </div>
            </div>
          )}

          {viewMode === 'detail' ? (
            <table className="w-full text-left border-collapse text-sm min-w-[1000px]">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th rowSpan={2} className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] w-12 text-center">序号</th>
                  <th rowSpan={2} className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc]">商品名称</th>
                  <th rowSpan={2} className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc]">单位</th>
                  <th colSpan={2} className="px-5 py-1.5 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-center border-l">上月结余</th>
                  <th colSpan={3} className="px-5 py-1.5 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-center border-l">本月入库</th>
                  <th colSpan={2} className="px-5 py-1.5 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-center border-l">本月出库</th>
                  <th colSpan={2} className="px-5 py-1.5 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-center border-l">本月结余</th>
                </tr>
                <tr className="bg-[#f8fafc]">
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center border-l">数量</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center">金额</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center border-l">数量</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center">单价</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center">金额</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center border-l">数量</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center">金额</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center border-l">数量</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-center">金额</th>
                </tr>
              </thead>
              <tbody className="text-[#1e293b]">
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3 border-b border-[#f1f5f9] text-center text-[#64748b]">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-5 py-3 border-b border-[#f1f5f9] font-medium">{row.productName}</td>
                    <td className="px-5 py-3 border-b border-[#f1f5f9] text-[#64748b]">{row.unit}</td>
                    
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-center border-l border-[#f1f5f9]">{row.prevBalanceQty.toFixed(2)}</td>
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-right">{formatCurrency(row.prevBalanceAmt)}</td>
                    
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-center border-l border-[#f1f5f9]">{row.inQty.toFixed(2)}</td>
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-right">{formatCurrency(row.price)}</td>
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-right font-medium">{formatCurrency(row.inAmt)}</td>
                    
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-center border-l border-[#f1f5f9]">{row.outQty.toFixed(2)}</td>
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-right font-medium">{formatCurrency(row.outAmt)}</td>
                    
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-center border-l border-[#f1f5f9]">{row.balanceQty.toFixed(2)}</td>
                    <td className="px-3 py-3 border-b border-[#f1f5f9] text-right">{formatCurrency(row.balanceAmt)}</td>
                  </tr>
                ))}
                <tr className="bg-[#f8fafc] font-semibold text-[#1e293b]">
                  <td className="px-5 py-3 border-t border-[#e2e8f0] text-center" colSpan={3}>合计</td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-center border-l border-[#f1f5f9]"></td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-right"></td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-center border-l border-[#f1f5f9]"></td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-right"></td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-right text-[#2563eb]">{formatCurrency(totalInAmt)}</td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-center border-l border-[#f1f5f9]"></td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-right text-[#2563eb]">{formatCurrency(totalOutAmt)}</td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-center border-l border-[#f1f5f9]"></td>
                  <td className="px-3 py-3 border-t border-[#e2e8f0] text-right"></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="px-5 py-4 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0]">商品名称</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0]">单位</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-right">本期入库总量</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-right">本期入库总额</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-right">本期出库总量</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] text-right">本期出库总额</th>
                </tr>
              </thead>
              <tbody className="text-[#1e293b]">
                {productSummaryRows.map((row, index) => (
                  <tr key={index} className="hover:bg-[#f8fafc] transition-colors border-b border-[#f1f5f9]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1e293b]">{row.productName}</span>
                        {highlights?.maxQtyProduct.productName === row.productName && (
                          <span className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">数量最高</span>
                        )}
                        {highlights?.maxAmtProduct.productName === row.productName && (
                          <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">金额最高</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#64748b]">{row.unit}</td>
                    <td className="px-5 py-4 text-right font-medium">{row.inQty.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right font-bold text-[#2563eb]">{formatCurrency(row.inAmt)}</td>
                    <td className="px-5 py-4 text-right font-medium">{row.outQty.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right font-bold text-[#64748b]">{formatCurrency(row.outAmt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
