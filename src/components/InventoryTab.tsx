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
      <div className="bg-white p-12 rounded-xl shadow-md border border-slate-300 text-center flex flex-col items-center font-sans">
        <FileText className="w-16 h-16 text-slate-400 mb-6" />
        <h2 className="text-xl font-black text-slate-900 mb-3">暂无出入库数据</h2>
        <p className="text-base text-slate-700 font-bold">请先在「销货单录入」中添加记录，系统将自动生成报表。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full font-sans">
      <header className="flex justify-between items-end">
        <div>
          {selectedPeriod && (
            <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-800 rounded-full text-xs font-black mb-2 uppercase tracking-widest border border-blue-300">
              {selectedPeriod} 生命周期
            </span>
          )}
          <h1 className="text-[1.75rem] font-black text-slate-950 leading-tight tracking-tight">出入库明细与财务对账统计</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={exportPaymentPlan}
            className="flex items-center space-x-2 bg-emerald-600 border-2 border-emerald-700 px-5 py-2 rounded-md text-sm font-black text-slate-950 hover:bg-emerald-700 transition-all shadow-md active:scale-95"
          >
            <FileText className="w-5 h-5 text-white" />
            <span>导出付款计划</span>
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center space-x-2 bg-white border-2 border-slate-400 px-5 py-2 rounded-md text-sm font-black text-slate-900 hover:bg-slate-50 transition-all shadow-md active:scale-95"
          >
            <FileSpreadsheet className="w-5 h-5 text-blue-700" />
            <span>导出报表</span>
          </button>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-black text-slate-800">对账周期:</label>
            <select 
              value={selectedPeriod} 
              onChange={e => setSelectedPeriod(e.target.value)}
              className="rounded-md border-2 border-slate-400 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-black text-slate-900"
            >
              {periods.filter(Boolean).map(p => (
                <option key={`period-${p}`} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="p-6 rounded-2xl bg-white shadow-md border-2 border-slate-300 hover:shadow-lg transition-all group flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-200">
              <Package className="w-6 h-6" />
            </div>
            <div className="text-xs font-black text-slate-600 uppercase tracking-widest">本期累计采购额</div>
          </div>
          <div className="text-3xl font-black text-slate-950 tracking-tighter">¥ {formatCurrency(totalInAmt)}</div>
        </div>
        <div className="p-6 rounded-2xl bg-white shadow-md border-2 border-slate-300 hover:shadow-lg transition-all group flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors border border-amber-200">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="text-xs font-black text-slate-600 uppercase tracking-widest">本期累计消耗额</div>
          </div>
          <div className="text-3xl font-black text-slate-950 tracking-tighter">¥ {formatCurrency(totalOutAmt)}</div>
        </div>
        <div className="p-6 rounded-2xl bg-slate-900 shadow-xl border-2 border-slate-800 text-white relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/10 text-blue-400 rounded-xl backdrop-blur-sm border border-white/10">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">实际应付 (下浮 {reductionRate}%)</div>
            </div>
            <div className="text-3xl font-black text-emerald-400 tracking-tighter">¥ {formatCurrency(invoiceAmount)}</div>
          </div>
        </div>
      </section>

      {/* Floating Summary Component */}
      <AnimatePresence>
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-fit"
        >
          <div className="bg-slate-950 border-2 border-slate-700 rounded-full shadow-2xl p-1.5 flex items-center gap-2">
            {isSummaryExpanded ? (
              <motion.div 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex items-center gap-8 px-8 py-3.5 overflow-hidden"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg border border-blue-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">入库额</div>
                    <div className="text-xl font-black text-white leading-none whitespace-nowrap">¥ {formatCurrency(totalInAmt)}</div>
                  </div>
                </div>

                <div className="w-px h-10 bg-slate-800"></div>

                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg border border-emerald-400">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">下浮节省</div>
                    <div className="text-xl font-black text-emerald-400 leading-none whitespace-nowrap">¥ {formatCurrency(totalInAmt - invoiceAmount)}</div>
                  </div>
                </div>

                <div className="w-px h-10 bg-slate-800"></div>

                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-amber-600 rounded-full flex items-center justify-center text-white shadow-lg border border-amber-400">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1.5">结算总计</div>
                    <div className="text-xl font-black text-amber-500 leading-none whitespace-nowrap">¥ {formatCurrency(invoiceAmount)}</div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="px-8 py-4 flex items-center gap-4">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">财务摘要</div>
                <div className="text-base font-black text-white">结算 ¥ {formatCurrency(invoiceAmount)}</div>
              </div>
            )}
            
            <button 
              onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
              className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center border border-slate-600 shadow-inner"
            >
              {isSummaryExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronUp className="w-6 h-6" />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <section className="bg-white rounded-xl shadow-md border-2 border-slate-300 flex flex-col flex-1 overflow-hidden min-h-[500px]">
        <div className="px-5 py-5 border-b-2 border-slate-300 flex flex-col lg:flex-row justify-between items-center gap-6 bg-slate-100">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-lg font-black text-slate-950">对账统计明细表</h2>
              <span className="text-xs text-slate-800 font-bold uppercase tracking-wider">统计范围内共有 {viewMode === 'detail' ? rows.length : productSummaryRows.length} 个商品项</span>
            </div>
            <div className="flex bg-slate-300 p-1.5 rounded-xl ml-4 shadow-inner">
              <button
                onClick={() => setViewMode('detail')}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black transition-all",
                  viewMode === 'detail' ? "bg-white text-blue-800 shadow-md" : "text-slate-700 hover:text-slate-950"
                )}
              >
                <List className="w-5 h-5" />
                明细模式
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black transition-all",
                  viewMode === 'summary' ? "bg-white text-blue-800 shadow-md" : "text-slate-700 hover:text-slate-950"
                )}
              >
                <LayoutGrid className="w-5 h-5" />
                汇总模式
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="搜索商品..." 
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="pl-11 pr-4 py-2.5 w-64 rounded-xl border-2 border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold bg-white"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-slate-800">单位:</span>
              <select 
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                className="rounded-xl border-2 border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-w-[120px] font-black"
              >
                <option key="all-units" value="">全部单位</option>
                {uniqueUnits.filter(Boolean).map(u => <option key={`unit-${u}`} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-auto flex-1 bg-white">
          {viewMode === 'summary' && highlights && (
            <div className="px-5 py-4 bg-slate-50 border-b-2 border-slate-200 flex flex-wrap gap-6">
              <div className="flex items-center gap-3 px-4 py-2 bg-amber-100 text-amber-900 rounded-xl border-2 border-amber-300">
                <Trophy className="w-5 h-5 text-amber-700" />
                <span className="text-xs font-black uppercase tracking-widest">单量冠军:</span>
                <span className="text-base font-black underline decoration-amber-400 decoration-2">{highlights.maxQtyProduct.productName}</span>
                <span className="text-sm font-black bg-amber-200 px-2 py-0.5 rounded-md border border-amber-300">{highlights.maxQtyProduct.inQty} {highlights.maxQtyProduct.unit}</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-100 text-blue-900 rounded-xl border-2 border-blue-300">
                <DollarSign className="w-5 h-5 text-blue-700" />
                <span className="text-xs font-black uppercase tracking-widest">采购金额之王:</span>
                <span className="text-base font-black underline decoration-blue-400 decoration-2">{highlights.maxAmtProduct.productName}</span>
                <span className="text-base font-black text-red-700 underline decoration-red-400 decoration-2">¥{highlights.maxAmtProduct.inAmt.toLocaleString()}</span>
              </div>
            </div>
          )}

          {viewMode === 'detail' ? (
            <table className="w-full text-left border-collapse text-sm min-w-[1200px]">
              <thead>
                <tr className="bg-slate-200">
                  <th rowSpan={2} className="px-5 py-4 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 sticky top-0 bg-slate-200 w-16 text-center">序号</th>
                  <th rowSpan={2} className="px-5 py-4 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 sticky top-0 bg-slate-200">商品名称</th>
                  <th rowSpan={2} className="px-5 py-4 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 sticky top-0 bg-slate-200">单位</th>
                  <th colSpan={2} className="px-5 py-2 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 sticky top-0 bg-slate-200 text-center border-l-2">上月结存 (结转)</th>
                  <th colSpan={3} className="px-5 py-2 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 sticky top-0 bg-slate-200 text-center border-l-2">本月采购 (入库)</th>
                  <th colSpan={2} className="px-5 py-2 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 sticky top-0 bg-slate-200 text-center border-l-2">本月领用 (消耗)</th>
                  <th colSpan={2} className="px-5 py-2 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 sticky top-0 bg-slate-200 text-center border-l-2">期末库存 (余额)</th>
                </tr>
                <tr className="bg-slate-200">
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center border-l-2">结余量</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center">结存金额</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center border-l-2">入库量</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center">基准价</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center">入库额</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center border-l-2">消耗量</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center">消耗额</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center border-l-2">库存量</th>
                  <th className="px-3 py-2 text-[11px] font-black uppercase text-slate-800 border-b-2 border-slate-400 text-center">库存额</th>
                </tr>
              </thead>
              <tbody className="text-slate-900 border-slate-200">
                {rows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-100 transition-colors border-b-2 border-slate-200">
                    <td className="px-5 py-4 text-center text-slate-600 font-black">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-5 py-4 font-black text-slate-900">{row.productName}</td>
                    <td className="px-5 py-4 text-slate-700 font-bold">{row.unit}</td>
                    
                    <td className="px-3 py-4 text-center border-l-2 border-slate-200 font-bold">{row.prevBalanceQty.toFixed(2)}</td>
                    <td className="px-3 py-4 text-right font-bold text-slate-700">{formatCurrency(row.prevBalanceAmt)}</td>
                    
                    <td className="px-3 py-4 text-center border-l-2 border-slate-200 font-black text-blue-800">{row.inQty.toFixed(2)}</td>
                    <td className="px-3 py-4 text-right font-bold">{formatCurrency(row.price)}</td>
                    <td className="px-3 py-4 text-right font-black text-blue-900">{formatCurrency(row.inAmt)}</td>
                    
                    <td className="px-3 py-4 text-center border-l-2 border-slate-200 font-black text-amber-800">{row.outQty.toFixed(2)}</td>
                    <td className="px-3 py-4 text-right font-black text-amber-900">{formatCurrency(row.outAmt)}</td>
                    
                    <td className="px-3 py-4 text-center border-l-2 border-slate-200 font-black text-teal-800">{row.balanceQty.toFixed(2)}</td>
                    <td className="px-3 py-4 text-right font-black text-teal-900">{formatCurrency(row.balanceAmt)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-400">
                  <td className="px-5 py-5 text-center text-base" colSpan={3}>全周期采购/消耗汇总合计</td>
                  <td className="px-3 py-5 text-center border-l-2 border-slate-200"></td>
                  <td className="px-3 py-5 text-right"></td>
                  <td className="px-3 py-5 text-center border-l-2 border-slate-200"></td>
                  <td className="px-3 py-5 text-right"></td>
                  <td className="px-3 py-5 text-right text-lg text-blue-800 outline outline-2 outline-blue-200 shadow-inner px-4">{formatCurrency(totalInAmt)}</td>
                  <td className="px-3 py-5 text-center border-l-2 border-slate-200"></td>
                  <td className="px-3 py-5 text-right text-lg text-amber-800 outline outline-2 outline-amber-200 shadow-inner px-4">{formatCurrency(totalOutAmt)}</td>
                  <td className="px-3 py-5 text-center border-l-2 border-slate-200"></td>
                  <td className="px-3 py-5 text-right"></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-sm min-w-[1000px]">
              <thead>
                <tr className="bg-slate-200">
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400">商品名称 (汇总)</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 w-32">单位</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 text-right w-48">本期累计入库量</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 text-right w-48">本期累计入库额</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 text-right w-48">本期累计出库量</th>
                  <th className="px-6 py-5 text-xs font-black uppercase text-slate-800 border-b-2 border-slate-400 text-right w-48">本期累计出库额</th>
                </tr>
              </thead>
              <tbody className="text-slate-900">
                {productSummaryRows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-100 transition-colors border-b-2 border-slate-200">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-950 text-base">{row.productName}</span>
                        {highlights?.maxQtyProduct.productName === row.productName && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-md font-black border border-amber-300">数量榜首</span>
                        )}
                        {highlights?.maxAmtProduct.productName === row.productName && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-md font-black border border-blue-300">货值最重</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-slate-700 font-bold">{row.unit}</td>
                    <td className="px-6 py-5 text-right font-black text-blue-800">{row.inQty.toFixed(2)}</td>
                    <td className="px-6 py-5 text-right font-black text-blue-900 text-base underline decoration-2 decoration-blue-200">{formatCurrency(row.inAmt)}</td>
                    <td className="px-6 py-5 text-right font-black text-amber-800">{row.outQty.toFixed(2)}</td>
                    <td className="px-6 py-5 text-right font-black text-amber-900">{formatCurrency(row.outAmt)}</td>
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
