import React, { useState, useRef, useMemo } from 'react';
import { Entry, Vendor } from '../types';
import { getPeriodName, formatCurrency, cn } from '../lib/utils';
import { AlertCircle, Trash2, Download, Plus, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface EntryTabProps {
  entries: Entry[];
  addEntry: (entry: Entry) => void;
  deleteEntry: (id: string) => void;
  referencePrices: Record<string, number>;
  vendors: Vendor[];
}

const DEFAULT_UNITS = ['斤', '公斤', '克', '个', '袋', '桶', '件', '瓶'];

interface BulkItem {
  id: string;
  productName: string;
  vendorId: string;
  unit: string;
  customUnit: string;
  quantity: number | '';
  price: number | '';
  remarks: string;
}

const createEmptyBulkItem = (defaultVendorId = ''): BulkItem => ({
  id: crypto.randomUUID(),
  productName: '',
  vendorId: defaultVendorId,
  unit: '斤',
  customUnit: '',
  quantity: '',
  price: '',
  remarks: ''
});

export default function EntryTab({ entries, addEntry, deleteEntry, referencePrices, vendors }: EntryTabProps) {
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Single Entry States
  const [productName, setProductName] = useState('');
  const [vendorId, setVendorId] = useState(() => vendors.find(v => v.isPreferred)?.id || (vendors[0]?.id) || '');
  const [unit, setUnit] = useState('斤');
  const [customUnit, setCustomUnit] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');
  const [singleWarningActive, setSingleWarningActive] = useState(false);

  // Bulk Entry States
  const [bulkItems, setBulkItems] = useState<BulkItem[]>(() => [createEmptyBulkItem(vendors.find(v => v.isPreferred)?.id || (vendors[0]?.id) || '')]);
  const [bulkWarnings, setBulkWarnings] = useState<Set<number>>(new Set());
  const [bulkWarningActive, setBulkWarningActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterVendorId, setFilterVendorId] = useState('');

  const uniqueProducts = useMemo(() => {
    const fromEntries = entries.map(e => e.productName);
    const fromRef = Object.keys(referencePrices);
    return Array.from(new Set([...fromEntries, ...fromRef])).sort();
  }, [entries, referencePrices]);

  const filteredEntries = useMemo(() => {
    return [...entries].reverse().filter(entry => {
      if (filterStartDate && entry.date < filterStartDate) return false;
      if (filterEndDate && entry.date > filterEndDate) return false;
      if (filterVendorId && entry.vendorId !== filterVendorId) return false;
      return true;
    });
  }, [entries, filterStartDate, filterEndDate, filterVendorId]);

  const filteredTotalAmount = useMemo(() => filteredEntries.reduce((sum, entry) => sum + entry.subtotal, 0), [filteredEntries]);

  const currentBulkTotal = bulkItems.reduce((sum, item) => {
    const q = typeof item.quantity === 'number' ? item.quantity : 0;
    const p = typeof item.price === 'number' ? item.price : 0;
    return sum + (q * p);
  }, 0);

  const downloadTemplate = () => {
    const wsData = [
      ['商品名称', '单位', '数量', '单价', '备注'],
      ['大白菜', '斤', 10.5, 2.5, '示例数据，导入前请删除这两行'],
      ['猪肉', '公斤', 5, 25.0, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 15 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "导入模板");
    XLSX.writeFile(wb, "批量录入模板.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        const newItems: BulkItem[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0 || (!row[0] && !row[1] && !row[2] && !row[3])) continue;

          let u = row[1] ? String(row[1]).trim() : '斤';
          let customU = '';
          if (!DEFAULT_UNITS.includes(u)) {
             customU = u;
             u = '自定义';
          }

          const defaultVendorId = vendors.find(v => v.isPreferred)?.id || (vendors[0]?.id) || '';
          newItems.push({
            id: crypto.randomUUID(),
            productName: row[0] ? String(row[0]).trim() : '',
            vendorId: defaultVendorId,
            unit: u,
            customUnit: customU,
            quantity: row[2] !== undefined && row[2] !== '' && !isNaN(Number(row[2])) ? Number(row[2]) : '',
            price: row[3] !== undefined && row[3] !== '' && !isNaN(Number(row[3])) ? Number(row[3]) : '',
            remarks: row[4] ? String(row[4]).trim() : ''
          });
        }
        
        if (newItems.length > 0) {
          if (bulkItems.length === 1 && !bulkItems[0].productName && bulkItems[0].quantity === '' && bulkItems[0].price === '') {
            setBulkItems(newItems);
          } else {
            setBulkItems([...bulkItems, ...newItems]);
          }
        } else {
          alert('未能从该Excel文件中识别到有效的数据行，请确保格式正确。');
        }
      } catch (err) {
        alert('文件解析失败，请确保您上传的是格式正确的Excel文件。');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const exportToExcel = () => {
    const wsData: any[][] = [
      ['销货清单录入记录'],
      [
        `按日期导出: ${filterStartDate || '最初'} 至 ${filterEndDate || '最新'}`,
        `共 ${filteredEntries.length} 条 | 消费合计: ${formatCurrency(filteredTotalAmount)}`
      ],
      [],
      ['日期', '对账周期', '商品名称', '单位', '数量', '单价(元)', '小计(元)', '备注']
    ];

    filteredEntries.forEach(entry => {
      wsData.push([
        entry.date,
        entry.periodName,
        entry.productName,
        entry.unit,
        entry.quantity,
        entry.price,
        entry.subtotal,
        entry.remarks || ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "录入记录");

    let filename = '录入记录导出.xlsx';
    if (filterStartDate && filterEndDate) {
      filename = `录入记录_${filterStartDate}_至_${filterEndDate}.xlsx`;
    } else if (filterStartDate) {
      filename = `录入记录_${filterStartDate}起.xlsx`;
    } else if (filterEndDate) {
      filename = `录入记录_至${filterEndDate}.xlsx`;
    }

    XLSX.writeFile(wb, filename);
  };

  const subtotal = (typeof quantity === 'number' && typeof price === 'number') ? quantity * price : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !productName || typeof quantity !== 'number' || typeof price !== 'number') {
      alert('请填写完整的必填信息');
      return;
    }

    const finalUnit = unit === '自定义' ? customUnit : unit;
    if (!finalUnit.trim()) {
      alert('请输入单位');
      return;
    }

    const trimmedName = productName.trim();
    const refPrice = referencePrices[trimmedName];
    if (refPrice !== undefined && price > refPrice && !singleWarningActive) {
      setSingleWarningActive(true);
      return;
    }

    const newEntry: Entry = {
      id: crypto.randomUUID(),
      date,
      productName: trimmedName,
      unit: finalUnit.trim(),
      quantity,
      price,
      subtotal,
      remarks: remarks.trim(),
      periodName: getPeriodName(date),
      refPriceAtEntry: referencePrices[trimmedName] ?? undefined,
      vendorId: vendorId,
    };

    addEntry(newEntry);
    
    // Reset form mostly, keep date
    setProductName('');
    setQuantity('');
    setPrice('');
    setRemarks('');
    setSingleWarningActive(false);
    // keep unit
  };

  const handleBulkItemChange = (index: number, field: keyof BulkItem, value: any) => {
    const newItems = [...bulkItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setBulkItems(newItems);
    
    if (field === 'productName' || field === 'price') {
      if (bulkWarningActive) {
        setBulkWarningActive(false);
        setBulkWarnings(new Set());
      }
    }
  };

  const removeBulkItem = (index: number) => {
    if (bulkItems.length === 1) return;
    const newItems = [...bulkItems];
    newItems.splice(index, 1);
    setBulkItems(newItems);
  };

  const handleBulkSubmit = () => {
    if (!date) {
      alert('请填写统一日期 *');
      return;
    }

    const validEntries: Entry[] = [];
    let hasError = false;
    let hasWarning = false;
    const newBulkWarnings = new Set<number>();

    for (let i = 0; i < bulkItems.length; i++) {
      const item = bulkItems[i];
      // Skip completely empty rows
      if (!item.productName && typeof item.quantity !== 'number' && typeof item.price !== 'number' && !item.remarks) {
        continue;
      }

      if (!item.productName || typeof item.quantity !== 'number' || typeof item.price !== 'number') {
        alert(`第 ${i + 1} 行信息不完整 (需填写商品、数量、单价)`);
        hasError = true;
        break;
      }

      const finalUnit = item.unit === '自定义' ? item.customUnit : item.unit;
      if (!finalUnit.trim()) {
        alert(`请输入第 ${i + 1} 行的单位`);
        hasError = true;
        break;
      }

      const trimmedName = item.productName.trim();
      if (!bulkWarningActive) {
        const refPrice = referencePrices[trimmedName];
        if (refPrice !== undefined && item.price > refPrice) {
          newBulkWarnings.add(i);
          hasWarning = true;
        }
      }

      validEntries.push({
        id: crypto.randomUUID(),
        date,
        productName: trimmedName,
        unit: finalUnit.trim(),
        quantity: item.quantity,
        price: item.price,
        subtotal: item.quantity * item.price,
        remarks: item.remarks.trim(),
        periodName: getPeriodName(date),
        refPriceAtEntry: referencePrices[trimmedName] ?? undefined,
        vendorId: item.vendorId,
      });
    }

    if (hasError) return;

    if (!hasError && validEntries.length === 0) {
      alert('请至少填写一条有效数据');
      return;
    }

    if (hasWarning && newBulkWarnings.size > 0 && !bulkWarningActive) {
      setBulkWarnings(newBulkWarnings);
      setBulkWarningActive(true);
      return;
    }

    validEntries.forEach(entry => addEntry(entry));
    setBulkItems([createEmptyBulkItem()]);
    setBulkWarnings(new Set());
    setBulkWarningActive(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full font-sans">
      <div className="bg-white rounded-xl shadow-md border border-slate-300 flex flex-col shrink-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-300 flex justify-between items-center bg-slate-100">
          <h2 className="text-base font-bold text-slate-900">单据录入</h2>
          <div className="flex bg-slate-200 rounded-lg p-1">
            <button 
              className={cn("px-4 py-1.5 text-sm font-bold rounded-md transition-all", !isBulkMode ? "bg-white shadow-sm text-blue-700" : "text-slate-600 hover:text-slate-900")}
              onClick={() => setIsBulkMode(false)}
            >
              单条录入
            </button>
            <button 
              className={cn("px-4 py-1.5 text-sm font-bold rounded-md transition-all", isBulkMode ? "bg-white shadow-sm text-blue-700" : "text-slate-600 hover:text-slate-900")}
              onClick={() => setIsBulkMode(true)}
            >
              批量录入
            </button>
          </div>
        </div>

        {!isBulkMode ? (
          <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">日期 *</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">供应商 *</label>
              <select 
                value={vendorId} 
                onChange={e => setVendorId(e.target.value)} 
                className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold bg-white"
              >
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                {vendors.length === 0 && <option value="">请先添加供应商</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">商品名称 *</label>
              <input type="text" list="product-names" required value={productName} 
                onChange={e => {
                  setProductName(e.target.value);
                  setSingleWarningActive(false);
                }} 
                placeholder="如：大白菜" 
                className={cn("w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 font-bold", 
                  singleWarningActive ? "border-red-500 focus:ring-red-700 bg-red-50" : "border-slate-400 focus:ring-blue-600"
                )} 
              />
            </div>
            <div className="flex space-x-2">
              <div className="flex-1">
                <label className="block text-sm font-bold text-slate-800 mb-1">单位 *</label>
                <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold bg-white">
                  {DEFAULT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  <option value="自定义">自定义...</option>
                </select>
              </div>
              {unit === '自定义' && (
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-800 mb-1">自定义</label>
                  <input type="text" required value={customUnit} onChange={e => setCustomUnit(e.target.value)} className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">数量 *</label>
              <input type="number" step="0.01" min="0" required value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">单价(元) *</label>
              <input type="number" step="0.01" min="0" required value={price} 
                onChange={e => {
                  setPrice(e.target.value === '' ? '' : Number(e.target.value));
                  setSingleWarningActive(false);
                }} 
                className={cn("w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 font-black", 
                  singleWarningActive ? "border-red-600 ring-2 ring-red-600 bg-red-50 text-red-700" : "border-slate-400 focus:ring-blue-600"
                )} 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">小计(元)</label>
              <input type="text" readOnly value={formatCurrency(subtotal)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-900 cursor-not-allowed font-black" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-bold text-slate-800 mb-1">备注</label>
              <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="选填" className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold" />
            </div>
            <div className="lg:col-span-4 flex justify-between items-center mt-2">
              <div className="flex flex-col gap-1">
                {productName.trim() && referencePrices[productName.trim()] !== undefined && (
                  <div className="text-xs text-red-700 flex items-center font-black bg-red-100 px-2 py-1 rounded w-fit border border-red-300">
                    已开启基准价监控，上限: {formatCurrency(referencePrices[productName.trim()])}
                  </div>
                )}
                {singleWarningActive ? (
                  <div className="text-sm text-red-700 flex items-center font-black">
                    <AlertCircle className="w-4 h-4 mr-1.5" /> 录入的单价超过了该商品的市场基准价监控 ({formatCurrency(referencePrices[productName.trim()])})
                  </div>
                ) : <div></div>}
              </div>
              <button type="submit" className={cn("text-white px-8 py-2.5 rounded-md text-sm font-black transition-all shadow-md shrink-0", singleWarningActive ? "bg-red-700 hover:bg-red-800 ring-4 ring-red-200" : "bg-blue-600 hover:bg-blue-700")}>
                {singleWarningActive ? '价格严重超标，确认强制录入' : '立即保存单据'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-4 border-b border-[#e2e8f0] pb-4">
              <div className="w-48">
                <label className="block text-sm font-medium text-[#1e293b] mb-1">统一日期 *</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-md border border-[#e2e8f0] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]" />
              </div>
              <div className="flex-1 text-xs text-[#64748b] pt-5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#1e293b]">提示：</span>您正在使用连续录入功能。您可以一次性添加同一天的多个采购条目，完成后点击“批量提交”。
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={downloadTemplate} className="flex items-center gap-1 text-[#2563eb] hover:bg-blue-50 px-2 py-1 rounded transition-colors" title="下载Excel导入模板">
                    <Download className="w-4 h-4" /> 模板下载
                  </button>
                  <label className="flex items-center gap-1 text-[#10b981] hover:bg-emerald-50 px-2 py-1 rounded transition-colors cursor-pointer" title="导入Excel文件快速填充表格">
                    <Upload className="w-4 h-4" /> 导入明细
                    <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </div>

            <div className="border border-slate-400 rounded-md overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-200 border-b border-slate-400 text-xs font-black text-slate-800">
                  <tr>
                    <th className="px-3 py-2 w-10 text-center">序号</th>
                    <th className="px-3 py-2 w-40">供应商 *</th>
                    <th className="px-3 py-2 min-w-[150px]">商品名称 *</th>
                    <th className="px-3 py-2 w-32">单位 *</th>
                    <th className="px-3 py-2 w-28">数量 *</th>
                    <th className="px-3 py-2 w-32">单价(元) *</th>
                    <th className="px-3 py-2 w-28">小计(元)</th>
                    <th className="px-3 py-2 min-w-[120px]">备注</th>
                    <th className="px-3 py-2 w-16 text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkItems.map((item, index) => {
                    const itemSubtotal = (typeof item.quantity === 'number' && typeof item.price === 'number') ? item.quantity * item.price : 0;
                    const isWarning = bulkWarnings.has(index);
                    const trimmedName = item.productName.trim();
                    const refPrice = trimmedName ? referencePrices[trimmedName] : undefined;
                    
                    return (
                      <tr key={item.id} className={cn("border-b transition-colors", isWarning ? "bg-red-100 border-red-400" : "border-slate-300 hover:bg-slate-100")}>
                        <td className="px-3 py-2 text-center text-xs text-slate-600 align-top pt-3.5 font-black">{index + 1}</td>
                        <td className="px-3 py-2 align-top pt-2">
                          <select 
                            className={cn("w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 font-bold", isWarning ? "border-red-600 bg-white" : "border-slate-400 bg-white")} 
                            value={item.vendorId} 
                            onChange={e => handleBulkItemChange(index, 'vendorId', e.target.value)}
                          >
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top pt-2">
                          <input type="text" list="product-names" className={cn("w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 font-black", isWarning ? "border-red-600 focus:ring-red-700 bg-white" : "border-slate-400 focus:ring-blue-600")} value={item.productName} onChange={e => handleBulkItemChange(index, 'productName', e.target.value)} placeholder="商品" />
                        </td>
                        <td className="px-3 py-2 flex gap-1 align-top pt-2">
                          <select value={item.unit} onChange={e => handleBulkItemChange(index, 'unit', e.target.value)} className={cn("w-16 rounded border px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 font-black", isWarning ? "border-red-600 bg-white" : "border-slate-400 bg-white")}>
                             {DEFAULT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                             <option value="自定义">自定</option>
                          </select>
                          {item.unit === '自定义' && (
                             <input type="text" className={cn("w-14 rounded border px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 font-black", isWarning ? "border-red-600 bg-white" : "border-slate-400")} value={item.customUnit} onChange={e => handleBulkItemChange(index, 'customUnit', e.target.value)} placeholder="单位" />
                          )}
                        </td>
                        <td className="px-3 py-2 align-top pt-2">
                          <input type="number" step="0.01" min="0" className={cn("w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 font-black", isWarning ? "border-red-600 bg-white" : "border-slate-400")} value={item.quantity} onChange={e => handleBulkItemChange(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2 align-top pt-2">
                          <input type="number" step="0.01" min="0" className={cn("w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 font-black", isWarning ? "border-red-700 ring-2 ring-red-700 bg-red-100 text-red-800" : "border-slate-400 focus:ring-blue-600")} value={item.price} onChange={e => handleBulkItemChange(index, 'price', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0.00" />
                          {refPrice !== undefined && (
                            <div className="text-[11px] mt-1 whitespace-nowrap font-black text-red-700">
                              监控上限: {formatCurrency(refPrice)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top pt-2">
                          <input type="text" readOnly className="w-full rounded border border-slate-300 px-2 py-1 text-sm bg-slate-100 text-slate-900 cursor-not-allowed font-black" value={formatCurrency(itemSubtotal)} />
                        </td>
                        <td className="px-3 py-2 align-top pt-2">
                          <input type="text" className={cn("w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 font-bold", isWarning ? "border-red-600 bg-white" : "border-slate-400")} value={item.remarks} onChange={e => handleBulkItemChange(index, 'remarks', e.target.value)} placeholder="选填" />
                        </td>
                        <td className="px-3 py-2 text-center flex items-center justify-center align-top pt-2">
                          <button onClick={() => removeBulkItem(index)} disabled={bulkItems.length === 1} className={cn("p-2 rounded transition-colors mt-0.5", bulkItems.length === 1 ? "text-slate-300 cursor-not-allowed" : "text-red-700 hover:bg-red-100")}>
                             <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="product-names">
                {uniqueProducts.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <div className="flex items-center gap-6">
                <button type="button" onClick={() => setBulkItems([...bulkItems, createEmptyBulkItem(vendors.find(v => v.isPreferred)?.id || (vendors[0]?.id) || '')])} className="flex items-center gap-1 text-blue-800 text-sm font-black hover:text-blue-900 transition-colors uppercase tracking-wider">
                  <Plus className="w-5 h-5" /> 增加一行
                </button>
                {currentBulkTotal > 0 && (
                  <div className="text-sm text-slate-900 font-black bg-slate-200 px-4 py-2 rounded-md border-2 border-slate-400">
                    本单小计: <span className="text-red-700 text-lg ml-2">{formatCurrency(currentBulkTotal)}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {bulkWarningActive && (
                  <div className="text-sm text-red-700 flex items-center font-black animate-bounce">
                    <AlertCircle className="w-5 h-5 mr-1.5" /> ⚠️ 部分商品价格异常
                  </div>
                )}
                <button onClick={handleBulkSubmit} className={cn("text-white px-8 py-3 rounded-md text-sm font-black transition-all shadow-lg active:scale-95", bulkWarningActive ? "bg-red-700 hover:bg-red-800 ring-4 ring-red-200" : "bg-blue-600 hover:bg-blue-700")}>
                  {bulkWarningActive ? `价格超标，再次点击强制提交 (${bulkItems.length}笔)` : `保存批量录入记录 (${bulkItems.length}笔)`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-300 flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-300 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-100">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">最新录入记录</h2>
            <div className="flex flex-wrap items-center text-xs text-slate-700 gap-2 font-bold">
              <span>筛选出 {filteredEntries.length} 条 (总共 {entries.length} 条)</span>
              {filteredEntries.length > 0 && (
                <>
                  <span className="text-slate-400">|</span>
                  <span className="font-black">筛选共计消费: <span className="text-red-700 text-sm">{formatCurrency(filteredTotalAmount)}</span></span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-slate-800">供应商:</span>
              <select 
                value={filterVendorId} 
                onChange={e => setFilterVendorId(e.target.value)}
                className="rounded-md border border-slate-400 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 max-w-[150px] font-bold bg-white"
              >
                <option value="">全部供应商</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-slate-800">日期筛选:</span>
              <input 
                type="date" 
                value={filterStartDate} 
                onChange={e => setFilterStartDate(e.target.value)}
                className="rounded-md border border-slate-400 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold" 
              />
              <span className="text-sm text-slate-500 font-black">-</span>
              <input 
                type="date" 
                value={filterEndDate} 
                onChange={e => setFilterEndDate(e.target.value)}
                className="rounded-md border border-slate-400 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold" 
              />
            </div>
            
            <button 
              onClick={exportToExcel}
              className="flex items-center space-x-1 border border-slate-400 px-4 py-1.5 rounded-md text-sm font-black text-slate-900 bg-white hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-blue-700" />
              <span>导出记录</span>
            </button>
          </div>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-200">
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200">日期</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200">供应商</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200">对账周期</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200">商品名称</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200">单位</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200 text-right">数量</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200 text-right">单价(元)</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200 text-right">小计(元)</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200">备注</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="text-slate-900">
              {filteredEntries.map(entry => (
                <tr key={entry.id} className="border-b border-slate-300 hover:bg-slate-200/50 text-sm transition-colors">
                  <td className="px-5 py-3 text-slate-700 font-bold">{entry.date}</td>
                  <td className="px-5 py-3 font-black text-slate-900">{vendors.find(v => v.id === entry.vendorId)?.name || '未知'}</td>
                  <td className="px-5 py-3 text-slate-700"><span className="bg-slate-300 text-slate-900 px-2 py-1 rounded text-xs font-black">{entry.periodName}</span></td>
                  <td className="px-5 py-3 font-black text-slate-900">{entry.productName}</td>
                  <td className="px-5 py-3 text-slate-700 font-bold">{entry.unit}</td>
                  <td className="px-5 py-3 text-slate-900 text-right font-bold">{entry.quantity}</td>
                  <td className="px-5 py-3 text-slate-900 text-right font-bold">{formatCurrency(entry.price)}</td>
                  <td className="px-5 py-3 text-slate-900 text-right font-black">{formatCurrency(entry.subtotal)}</td>
                  <td className="px-5 py-3 text-slate-700 font-bold">{entry.remarks}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => deleteEntry(entry.id)} className="text-red-800 hover:text-red-900 p-1.5 rounded hover:bg-red-100 transition-colors" title="删除">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-600 font-bold">暂无符合条件的录入记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
