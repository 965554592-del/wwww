import React, { useRef, useState, useEffect } from 'react';
import { ShieldCheck, Download, Upload, Trash2, Info, Laptop, Monitor, Smartphone, AlertTriangle, HardDrive, Save, Settings, Lock } from 'lucide-react';
import { dbService } from '../services/dbService';
import { cn } from '../lib/utils';

interface DataManagementTabProps {
  onBackup: () => void;
  onRestore: (data: string) => void;
  onClearAll: () => void;
  onOpenPasswordModal: () => void;
  username: string;
}

export default function DataManagementTab({ onBackup, onRestore, onClearAll, onOpenPasswordModal, username }: DataManagementTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [dbPath, setDbPath] = useState('');
  const [isSavingPath, setIsSavingPath] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'warning', msg: string } | null>(null);

  useEffect(() => {
    const fetchPath = async () => {
      try {
        const path = await dbService.getStoragePath();
        setDbPath(path);
      } catch (e) {
        console.error('Failed to fetch storage path');
      }
    };
    fetchPath();
  }, []);

  const handleSavePath = async () => {
    if (!dbPath.trim()) {
      setSaveStatus({ type: 'warning', msg: '路径不能为空。' });
      return;
    }
    setIsSavingPath(true);
    setSaveStatus(null);
    try {
      await dbService.setStoragePath(dbPath);
      setSaveStatus({ type: 'success', msg: '物理路径已激活！系统已连接到新磁盘位置。' });
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (e: any) {
      setSaveStatus({ type: 'error', msg: `激活失败: ${e.message}。请确保路径格式正确且磁盘具有读写权限。` });
    } finally {
      setIsSavingPath(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onRestore(content);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-10 w-full max-w-5xl mx-auto font-sans pb-20">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-950 tracking-tight">系统内核与安全中心</h1>
            <p className="text-slate-500 font-bold text-sm">管理 AI 智能大脑、物理磁盘存储及财务数据安全。</p>
          </div>
        </div>
      </header>

      {/* Plate 1: AI & Security */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-4 w-1 bg-indigo-600 rounded-full"></div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">身份安全与智能配置</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security & User Card */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 flex flex-col gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                 <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">访问账户安全</h3>
            </div>
            
            <div className="space-y-1">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">当前登录身份</div>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                 <div className="text-2xl font-black text-slate-900">{username} <span className="text-xs text-slate-400 font-bold ml-2">管理员</span></div>
               </div>
            </div>

            <button 
              onClick={onOpenPasswordModal}
              className="mt-2 bg-slate-950 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 group"
            >
              <Lock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              修改系统访问密码
            </button>
          </div>

          {/* AI Engine Card */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-purple-100/30 border border-purple-50 p-8 flex flex-col gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700"></div>
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
                 <Save className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">AI 智能分析引擎</h3>
            </div>

            <div className="space-y-4 relative">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">引擎状态</span>
                <span className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm", 
                  import.meta.env.VITE_AI_MODE === 'china' ? "bg-emerald-500 text-white" : "bg-blue-600 text-white")}>
                  {import.meta.env.VITE_AI_MODE === 'china' ? "国内高可用模式" : "全球标准模式"}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase px-1">
                  <span>当前模型配置</span>
                  <span className="text-purple-600">DMXAPI 引擎</span>
                </div>
                <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl font-mono text-sm border border-slate-800 shadow-inner break-all">
                  {import.meta.env.VITE_DOMESTIC_AI_MODEL || 'KAT-Coder-ProV2-free'}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                  <span className="font-black underline decoration-amber-300">配置路径</span>：若需修改模型名或令牌，请点击 IDE 左下角齿轮选择 <span className="font-black">Secrets</span> 菜单添加对应变量。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plate 2: Data & Core */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">物理存储与数据容灾</h2>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* SQL Storage Card */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                   <HardDrive className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 italic tracking-tight">SQLite PROFESSIONAL CORE</h3>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">物理磁盘模式</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 rounded text-[9px] font-black uppercase tracking-widest border border-emerald-200">连接正常</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={onBackup} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs hover:bg-slate-200 transition-all flex items-center gap-2">
                  <Download className="w-4 h-4" /> 导出备份
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="px-5 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs hover:bg-slate-200 transition-all flex items-center gap-2 text-indigo-600">
                  <Upload className="w-4 h-4" /> 导入恢复
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-[1.5rem] border-2 border-slate-100 space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">磁盘存储路径控制</label>
                  <div className="flex gap-3">
                    <input 
                      type="text"
                      value={dbPath}
                      onChange={(e) => setDbPath(e.target.value)}
                      placeholder="例如: D:\CafeteriaData\cafeteria_v3.db"
                      className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-5 py-4 font-mono text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-slate-700 shadow-sm"
                    />
                    <button 
                      onClick={handleSavePath}
                      disabled={isSavingPath}
                      className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-sm hover:bg-indigo-600 transition-all shadow-lg active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSavingPath ? <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" /> : <Save className="w-5 h-5" />}
                      映射磁盘路径
                    </button>
                  </div>
               </div>
               
               {saveStatus && (
                <div className={cn("text-xs font-black px-4 py-3 rounded-xl border-2 transition-all animate-in slide-in-from-top-2", 
                  saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100')}>
                  {saveStatus.msg}
                </div>
               )}

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-xl border border-slate-200/50 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">为何需要映射？</p>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">指定本系统的数据库存储在您的物理 D 盘或云盘夹中，即使清空浏览器数据，财务账目也绝不丢失。</p>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200/50 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">导出规范</p>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">系统生成的 <code className="bg-slate-50 px-1">.json</code> 备份文件包含所有菜谱、单据及供应商。建议每周进行一次离线保存。</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-50/50 rounded-[2rem] border-2 border-red-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-xl font-black text-red-900 uppercase italic">灾难性数据清除</h3>
          <p className="text-sm text-red-700 font-bold max-w-lg">
            清空系统将永久删除本地所有单据、设置和配置，系统将恢复至出厂状态。操作不可撤销。
          </p>
        </div>

        {!showConfirmClear ? (
          <button onClick={() => setShowConfirmClear(true)} className="px-8 py-4 bg-white border-2 border-red-200 text-red-600 rounded-2xl font-black text-sm hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-md active:scale-95">
            初始化全量数据
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setShowConfirmClear(false)} className="px-6 py-4 bg-white text-slate-600 rounded-2xl font-black text-sm border border-slate-200">
              取消操作
            </button>
            <button onClick={onClearAll} className="px-6 py-4 bg-red-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-red-200 animate-pulse">
              确定执行删除
            </button>
          </div>
        )}
      </section>

      <footer className="text-center space-y-2 pb-10 mt-10">
        <div className="flex items-center justify-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">
          <span>Cafeteria Accounting System</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <span>Build 2026.04.19</span>
        </div>
      </footer>
    </div>
  );
}
