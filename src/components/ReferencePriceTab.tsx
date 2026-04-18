import React, { useState, useRef } from 'react';
import { formatCurrency } from '../lib/utils';
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
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex justify-between items-center bg-[#f8fafc] rounded-t-xl">
          <div>
            <h2 className="text-base font-semibold text-[#1e293b] flex items-center gap-2">
              <Store className="w-5 h-5 text-[#2563eb]" /> 市场基准价设置
            </h2>
          </div>
        </div>
        
        <div className="p-5 border-b border-[#e2e8f0]">
          <div className="flex flex-col gap-2 mb-4">
             <div className="text-sm font-medium text-[#1e293b] flex items-center gap-1.5">
               <AlertCircle className="w-4 h-4 text-[#eab308]" /> 
               功能说明
             </div>
             <p className="text-xs text-[#64748b] leading-relaxed">
               提前设置好食材的市场基准价或合同指导价。设置后，在「单据录入」时若输入的单价超过了该商品的基准价，系统会自动标红警报并要求二次确认才能提交，从而有效预防录入错误或价格异常流失。
             </p>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[#1e293b] mb-1">商品名称</label>
              <input type="text" list="ref-product-names" required value={productName} onChange={e => setProductName(e.target.value)} placeholder="输入或下拉选择历史商品..." className="w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]" />
              <datalist id="ref-product-names">
                {uniqueProducts.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-[#1e293b] mb-1">市场基准价(元)</label>
              <input type="number" step="0.01" min="0" required value={price} onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="输入监控拦截价格..." className="w-full rounded-md border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]" />
            </div>
            <div>
              <button type="submit" className="bg-[#2563eb] text-white px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90 flex items-center gap-1">
                <Plus className="w-4 h-4" /> 保存基准价
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1)] border border-[#e2e8f0] flex flex-col flex-1 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex justify-between items-center bg-[#f8fafc]">
          <div className="flex flex-col gap-1">
             <h2 className="text-base font-semibold text-[#1e293b]">基准价格列表</h2>
             <span className="text-xs text-[#64748b]">共设置了 {records.length} 个监控项</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate} className="flex items-center space-x-1 border border-[#e2e8f0] bg-white px-3 py-1.5 rounded-md text-sm font-medium text-[#2563eb] hover:bg-[#f1f5f9] transition-colors shadow-sm">
              <Download className="w-4 h-4" />
              <span>模板下载</span>
            </button>
            <label className="flex items-center space-x-1 border border-[#10b981] bg-[#10b981] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>导入基准价</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            </label>
          </div>
        </div>
        
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-[#f8fafc]">
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc]">商品名称</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-right">市场基准价(元)</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase text-[#64748b] border-b border-[#e2e8f0] sticky top-0 bg-[#f8fafc] text-center w-24">操作</th>
              </tr>
            </thead>
            <tbody className="text-[#1e293b]">
              {records.map(record => {
                const isEditing = editingName === record.name;
                return (
                  <tr key={record.name} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] text-sm transition-colors">
                    <td className="px-5 py-3 font-medium text-[#1e293b]">{record.name}</td>
                    <td className="px-5 py-3 text-right font-medium text-[#ef4444]">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-24 text-right rounded border border-[#2563eb] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563eb]"
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
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSaveEdit(record.name)} className="text-green-600 hover:text-green-700 p-1.5 rounded hover:bg-green-50 transition-colors" title="保存">
                              <Check className="w-4 h-4 mx-auto" />
                            </button>
                            <button onClick={handleCancelEdit} className="text-[#64748b] hover:text-slate-700 p-1.5 rounded hover:bg-slate-100 transition-colors" title="取消">
                              <X className="w-4 h-4 mx-auto" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEditClick(record.name, record.price)} className="text-[#2563eb] hover:text-blue-700 p-1.5 rounded hover:bg-blue-50 transition-colors" title="修改价格">
                              <Edit2 className="w-4 h-4 mx-auto" />
                            </button>
                            <button onClick={() => updateReferencePrice(record.name, null)} className="text-[#64748b] hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors" title="移除监控">
                              <Trash2 className="w-4 h-4 mx-auto" />
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
                  <td colSpan={3} className="py-8 text-center text-[#64748b]">暂无设置任何市场基准价</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
