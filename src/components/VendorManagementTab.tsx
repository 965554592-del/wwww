import React, { useState } from 'react';
import { Vendor } from '../types';
import { Plus, Trash2, Edit2, Check, X, Truck, User, Phone, Star } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  vendors: Vendor[];
  addVendor: (vendor: Vendor) => void;
  updateVendor: (vendor: Vendor) => void;
  deleteVendor: (id: string) => void;
}

export default function VendorManagementTab({ vendors, addVendor, updateVendor, deleteVendor }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Vendor>>({});

  const handleSave = () => {
    if (!formData.name) return;
    if (editingId) {
      updateVendor({ ...formData, id: editingId } as Vendor);
      setEditingId(null);
    } else {
      addVendor({
        ...formData,
        id: crypto.randomUUID(),
        isPreferred: formData.isPreferred || false
      } as Vendor);
      setIsAdding(false);
    }
    setFormData({});
  };

  const startEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setFormData(vendor);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">供应商库管理</h1>
          <p className="text-sm text-slate-500">维护常用的供应商信息，用于后续的价格对比与审计</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-slate-950 px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" /> 新增供应商
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isAdding && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-blue-200 p-6 flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
             <div className="text-sm font-bold text-blue-600 flex items-center gap-2 uppercase tracking-widest mb-2">
                <Truck className="w-4 h-4" /> 新供应商资料
             </div>
             <input 
               autoFocus
               placeholder="供应商名称 *"
               className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold"
               value={formData.name || ''}
               onChange={e => setFormData({ ...formData, name: e.target.value })}
             />
             <div className="flex gap-2">
               <div className="flex-1 relative">
                 <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                 <input 
                   placeholder="联系人"
                   className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                   value={formData.contact || ''}
                   onChange={e => setFormData({ ...formData, contact: e.target.value })}
                 />
               </div>
               <div className="flex-1 relative">
                 <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                 <input 
                   placeholder="电话"
                   className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                   value={formData.phone || ''}
                   onChange={e => setFormData({ ...formData, phone: e.target.value })}
                 />
               </div>
             </div>
             <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 mt-2">
                <input 
                  type="checkbox" 
                  checked={formData.isPreferred || false} 
                  onChange={e => setFormData({ ...formData, isPreferred: e.target.checked })}
                />
                设为首选供应商 (默认选中)
             </label>
             <div className="flex gap-2 mt-4">
               <button onClick={handleSave} className="flex-1 bg-blue-600 text-slate-950 py-2 rounded-lg font-bold text-sm">保存</button>
               <button onClick={() => setIsAdding(false)} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg font-bold text-sm">取消</button>
             </div>
          </div>
        )}

        {vendors.map(vendor => (
          <div key={vendor.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 group transition-all hover:shadow-xl hover:-translate-y-1">
            {editingId === vendor.id ? (
               <div className="flex flex-col gap-3">
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold"
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input 
                      placeholder="联系人"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600"
                      value={formData.contact || ''}
                      onChange={e => setFormData({ ...formData, contact: e.target.value })}
                    />
                    <input 
                      placeholder="电话"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600"
                      value={formData.phone || ''}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleSave} className="flex-1 bg-emerald-500 text-slate-950 py-1.5 rounded-lg text-xs font-bold">确定</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-100 text-slate-600 py-1.5 rounded-lg text-xs font-bold">取消</button>
                  </div>
               </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{vendor.name}</h3>
                        {vendor.isPreferred && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">供应商 ID: {vendor.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(vendor)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteVendor(vendor.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">联系人</span>
                    <span className="text-sm font-medium text-slate-600">{vendor.contact || '未记录'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">联系电话</span>
                    <span className="text-sm font-medium text-slate-600">{vendor.phone || '未记录'}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {vendors.length === 0 && !isAdding && (
          <div className="col-span-full border-2 border-dashed border-slate-200 rounded-3xl p-20 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
             <Truck className="w-16 h-16 mb-4 opacity-20" />
             <p className="font-bold uppercase tracking-widest text-sm">暂无供应商数据</p>
             <button onClick={() => setIsAdding(true)} className="mt-4 text-blue-600 font-bold hover:underline">点击新增您的第一个供应商</button>
          </div>
        )}
      </div>
    </div>
  );
}
