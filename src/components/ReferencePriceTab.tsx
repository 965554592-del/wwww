import React, { useState, useRef } from 'react';
import { formatCurrency, cn } from '../lib/utils';
import { Trash2, AlertCircle, Plus, Store, Download, Upload, Edit2, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReferencePriceTabProps {
  referencePrices: Record<string, number>;
  updateReferencePrice: (name: string, price: number | null) => void;
  bulkUpdateReferencePrices: (prices: Record<string, number>) => void;
  uniqueProducts: string[];
}

export default function ReferencePriceTab({ referencePrices, updateReferencePrice, bulkUpdateReferencePrices, uniqueProducts }: ReferencePriceTabProps) {
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number | ''>('');

  const handleEditClick = (name: string, currentPrice: number) => {
    setEditingName(name);
    setEditPrice(currentPrice);
  };

  const handleSaveEdit = (name: string) => {
    if (typeof editPrice === 'number' && editPrice >= 0) {
      updateReferencePrice(name, editPrice);
    }
    setEditingName(null);
    setEditPrice('');
  };

  const handleCancelEdit = () => {
    setEditingName(null);
    setEditPrice('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || typeof price !== 'number') return;
    updateReferencePrice(productName.trim(), price);
    setProductName('');
    setPrice('');
  };

  const records = Object.entries(referencePrices)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, price]) => ({ name, price }));

  const downloadTemplate = () => {
    const wsData = [
      ['商品名称', '市场基准价(元)'],
      ['大白菜', 2.5],
      ['猪肉', 25.0],
      ['示例数据，导入前请删除前三行（包括本行）', '']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "基准价导入模板");
    XLSX.writeFile(wb, "市场基准价_导入模板.xlsx");
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

        const newPrices: Record<string, number> = {};
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;
          
          const name = String(row[0] || '').trim();
          const priceVal = Number(row[1]);
          
          if (name && !isNaN(priceVal) && priceVal >= 0 && !name.includes('示例数据')) {
            newPrices[name] = priceVal;
          }
        }
        
        if (Object.keys(newPrices).length > 0) {
          bulkUpdateReferencePrices(newPrices);
          alert(`成功导入 ${Object.keys(newPrices).length} 条基准价！`);
        } else {
          alert('未能从该Excel文件中识别到有效的数据行，请确保格式正确（商品名称、市场基准价）。');
        }
      } catch (err) {
        alert('文件解析失败，请确保您上传的是格式正确的Excel文件。');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col gap-6 h-full font-sans">
      <div className="bg-white rounded-xl shadow-md border border-slate-300 flex flex-col shrink-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-300 flex justify-between items-center bg-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-700" /> 市场基准价设置
            </h2>
          </div>
        </div>
        
        <div className="p-5 border-b border-slate-300 bg-slate-50">
          <div className="flex flex-col gap-2 mb-6 p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
             <div className="text-sm font-black text-amber-900 flex items-center gap-1.5 uppercase">
               <AlertCircle className="w-5 h-5 text-amber-600" /> 
               功能说明 | 必读
             </div>
             <p className="text-xs text-amber-800 leading-relaxed font-bold">
               设置食材的市场基准价。设置后，在「单据录入」时若输入的单价超过了该商品的基准价，系统会自动标红警报并要求二次确认才能提交，从而有效预防录入错误或价格异常流失。
             </p>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-black text-slate-800 mb-1">商品名称</label>
              <input type="text" list="ref-product-names" required value={productName} onChange={e => setProductName(e.target.value)} placeholder="输入名称或选择商品..." className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold bg-white" />
              <datalist id="ref-product-names">
                {uniqueProducts.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-black text-slate-800 mb-1">市场基准价(元)</label>
              <input type="number" step="0.01" min="0" required value={price} onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="输入封顶价格..." className="w-full rounded-md border border-slate-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold bg-white" />
            </div>
            <div>
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-black transition-all hover:bg-blue-700 shadow-md flex items-center gap-2 uppercase tracking-wide active:scale-95">
                <Plus className="w-5 h-5" /> 保存基准价
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-300 flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-300 flex justify-between items-center bg-slate-100">
          <div className="flex flex-col gap-1">
             <h2 className="text-base font-black text-slate-900">基准价格列表</h2>
             <span className="text-xs text-slate-700 font-bold">已启用 {records.length} 个监控项</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={downloadTemplate} className="flex items-center space-x-1 border border-slate-400 bg-white px-3 py-1.5 rounded-md text-sm font-black text-blue-700 hover:bg-slate-50 transition-colors shadow-sm">
              <Download className="w-4 h-4" />
              <span>下载模板</span>
            </button>
            <label className="flex items-center space-x-1 border border-emerald-500 bg-emerald-600 text-white px-3 py-1.5 rounded-md text-sm font-black hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer active:scale-95">
              <Upload className="w-4 h-4" />
              <span>批量导入</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </label>
          </div>
        </div>
        
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-200">
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200">商品名称</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200 text-right">封顶监控价格(元)</th>
                <th className="px-5 py-3 text-xs font-black uppercase text-slate-800 border-b border-slate-400 sticky top-0 md:bg-slate-200 text-center w-32">操作控制</th>
              </tr>
            </thead>
            <tbody className="text-slate-900">
              {records.map(record => {
                const isEditing = editingName === record.name;
                return (
                  <tr key={record.name} className="border-b border-slate-300 hover:bg-slate-100 text-sm transition-colors">
                    <td className="px-5 py-4 font-black text-slate-900">{record.name}</td>
                    <td className="px-5 py-4 text-right font-black text-red-700 text-base">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-32 text-right rounded border-2 border-blue-600 px-2 py-1 text-sm focus:outline-none font-black text-blue-700 bg-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(record.name);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                      ) : (
                        formatCurrency(record.price)
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSaveEdit(record.name)} className="text-emerald-700 hover:bg-emerald-100 p-2 rounded-md transition-colors border border-emerald-200 bg-emerald-50" title="保存修改">
                              <Check className="w-5 h-5 mx-auto font-black" />
                            </button>
                            <button onClick={handleCancelEdit} className="text-slate-600 hover:bg-slate-200 p-2 rounded-md transition-colors border border-slate-300 bg-slate-100" title="放弃修改">
                              <X className="w-5 h-5 mx-auto font-black" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEditClick(record.name, record.price)} className="text-blue-700 hover:bg-blue-100 p-2 rounded-md transition-colors border border-blue-200 bg-blue-50" title="快速编辑价格">
                              <Edit2 className="w-5 h-5 mx-auto font-black" />
                            </button>
                            <button onClick={() => updateReferencePrice(record.name, null)} className="text-red-700 hover:bg-red-100 p-2 rounded-md transition-colors border border-red-200 bg-red-50" title="移除价格监控">
                              <Trash2 className="w-5 h-5 mx-auto font-black" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-600 font-bold text-base">暂无设置任何市场基准价，监控功能处于关闭状态。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
