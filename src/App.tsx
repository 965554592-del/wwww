/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import EntryTab from './components/EntryTab';
import PriceHistoryTab from './components/PriceHistoryTab';
import InventoryTab from './components/InventoryTab';
import ReferencePriceTab from './components/ReferencePriceTab';
import AnnualSummaryTab from './components/AnnualSummaryTab';
import TrendTab from './components/TrendTab';
import BenchmarkAuditTab from './components/BenchmarkAuditTab';
import VendorComparisonTab from './components/VendorComparisonTab';
import VendorManagementTab from './components/VendorManagementTab';
import MonthlyReportTab from './components/MonthlyReportTab';
import DataManagementTab from './components/DataManagementTab';
import RecipeMenuTab from './components/RecipeMenuTab';
import { Entry, Vendor, MonthlyReport, Recipe, WeeklyMenu } from './types';
import { computePriceRecords } from './lib/dataUtils';
import { dbService } from './services/dbService';
import { ClipboardList, TrendingUp, Package, Tag, PieChart, Wallet, LineChart as LineChartIcon, ShieldCheck, Truck, ArrowLeftRight, FileBarChart, Settings, Lock, User, LogOut } from 'lucide-react';
import { cn } from './lib/utils';

const STORAGE_KEY_AUTH = 'cafeteria_auth_state';
const STORAGE_KEY_USERNAME = 'cafeteria_username';
const STORAGE_KEY_PASSWORD = 'cafeteria_password';

// Legacy keys for migration
const LEGACY_KEYS = {
  ENTRIES: 'cafeteria_entries',
  REF_PRICES: 'cafeteria_ref_prices',
  REDUCTION_RATE: 'cafeteria_reduction_rate',
  VENDORS: 'cafeteria_vendors',
  REPORTS: 'cafeteria_reports',
};

export default function App() {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [credentials, setCredentials] = useState({
    username: localStorage.getItem(STORAGE_KEY_USERNAME) || 'YDJY123',
    password: localStorage.getItem(STORAGE_KEY_PASSWORD) || '12345678'
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_AUTH) === 'true';
  });

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPasswordForm, setNewPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  const [entries, setEntries] = useState<Entry[]>([]);
  const [reductionRate, setReductionRate] = useState<number>(17);
  const [referencePrices, setReferencePrices] = useState<Record<string, number>>({});
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);

  const [activeTab, setActiveTab] = useState<'entry' | 'price' | 'inventory' | 'reference' | 'annual-summary' | 'trend' | 'audit' | 'vendors' | 'vendor-comparison' | 'monthly-report' | 'recipe-menu' | 'settings'>('entry');

  // Load Data and Migrate from LocalStorage
  useEffect(() => {
    const initDatabase = async () => {
      try {
        // Check for migration
        const hasLegacyData = localStorage.getItem(LEGACY_KEYS.ENTRIES) !== null;
        
        if (hasLegacyData) {
          console.log('Migrating legacy data to IndexedDB...');
          const legacyEntries = JSON.parse(localStorage.getItem(LEGACY_KEYS.ENTRIES) || '[]');
          const legacyRefPrices = JSON.parse(localStorage.getItem(LEGACY_KEYS.REF_PRICES) || '{}');
          const legacyRate = parseFloat(localStorage.getItem(LEGACY_KEYS.REDUCTION_RATE) || '17');
          const legacyVendors = JSON.parse(localStorage.getItem(LEGACY_KEYS.VENDORS) || '[]');
          const legacyReports = JSON.parse(localStorage.getItem(LEGACY_KEYS.REPORTS) || '[]');

          await dbService.bulkSaveEntries(legacyEntries);
          await dbService.bulkSaveReferencePrices(legacyRefPrices);
          await dbService.saveSetting('reductionRate', legacyRate);
          for (const v of legacyVendors) await dbService.saveVendor(v);
          for (const r of legacyReports) await dbService.saveReport(r);

          // Clear legacy data
          Object.values(LEGACY_KEYS).forEach(k => localStorage.removeItem(k));
          console.log('Migration complete.');
        }

        // Load current data
        const loadedEntries = await dbService.getAllEntries();
        const loadedRefPrices = await dbService.getAllReferencePrices();
        const loadedRate = await dbService.getSetting('reductionRate', 17);
        const loadedVendors = await dbService.getAllVendors();
        const loadedReports = await dbService.getAllReports();
        const loadedRecipes = await dbService.getAllRecipes();
        const loadedWeeklyMenus = await dbService.getAllWeeklyMenus();

        setEntries(loadedEntries);
        setReferencePrices(loadedRefPrices);
        setReductionRate(loadedRate);
        setMonthlyReports(loadedReports);
        setRecipes(loadedRecipes);
        setWeeklyMenus(loadedWeeklyMenus);
        
        if (loadedVendors.length > 0) {
          setVendors(loadedVendors);
        } else {
          const defaultVendors = [
            { id: 'v1', name: '供应商A', isPreferred: true },
            { id: 'v2', name: '供应商B' }
          ];
          setVendors(defaultVendors);
          for (const v of defaultVendors) await dbService.saveVendor(v);
        }

      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        // Artificial delay for splash feel
        setTimeout(() => setIsAppLoading(false), 800);
      }
    };

    initDatabase();
  }, []);

  const addEntry = async (entry: Entry) => {
    setEntries(prev => [...prev, entry]);
    await dbService.saveEntry(entry);
  };

  const addEntries = async (newEntries: Entry[]) => {
    setEntries(prev => [...prev, ...newEntries]);
    await dbService.bulkSaveEntries(newEntries);
  };

  const deleteEntry = async (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    await dbService.deleteEntry(id);
  };

  const updateReferencePrice = async (name: string, price: number | null) => {
    setReferencePrices(prev => {
      const copy = { ...prev };
      if (price === null) {
        delete copy[name];
        dbService.deleteReferencePrice(name);
      } else {
        copy[name] = price;
        dbService.saveReferencePrice(name, price);
      }
      return copy;
    });
  };

  const bulkUpdateReferencePrices = async (newPrices: Record<string, number>) => {
    setReferencePrices(prev => ({ ...prev, ...newPrices }));
    await dbService.bulkSaveReferencePrices(newPrices);
  };

  const addVendor = async (vendor: Vendor) => {
    setVendors(prev => [...prev, vendor]);
    await dbService.saveVendor(vendor);
  };

  const deleteVendor = async (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    await dbService.deleteVendor(id);
  };

  const updateVendor = async (updated: Vendor) => {
    setVendors(prev => prev.map(v => v.id === updated.id ? updated : v));
    await dbService.saveVendor(updated);
  };

  const addOrUpdateReport = async (report: MonthlyReport) => {
    setMonthlyReports(prev => {
      const exists = prev.find(r => r.periodName === report.periodName);
      if (exists) {
        return prev.map(r => r.periodName === report.periodName ? report : r);
      }
      return [...prev, report];
    });
    await dbService.saveReport(report);
  };

  const addOrUpdateRecipe = async (recipe: Recipe) => {
    setRecipes(prev => {
      const exists = prev.find(r => r.id === recipe.id);
      if (exists) {
        return prev.map(r => r.id === recipe.id ? recipe : r);
      }
      return [...prev, recipe];
    });
    await dbService.saveRecipe(recipe);
  };

  const deleteRecipe = async (id: string) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
    await dbService.deleteRecipe(id);
  };

  const addOrUpdateWeeklyMenu = async (menu: WeeklyMenu) => {
    setWeeklyMenus(prev => {
      const exists = prev.find(m => m.weekId === menu.weekId);
      if (exists) {
        return prev.map(m => m.weekId === menu.weekId ? menu : m);
      }
      return [...prev, menu];
    });
    await dbService.saveWeeklyMenu(menu);
  };

  const handleUpdateReductionRate = async (val: number) => {
    setReductionRate(val);
    await dbService.saveSetting('reductionRate', val);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.username === credentials.username && loginForm.password === credentials.password) {
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_KEY_AUTH, 'true');
      setLoginError('');
    } else {
      setLoginError('账号或密码错误，请重新输入');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_KEY_AUTH);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordForm.oldPassword !== credentials.password) {
      setPasswordChangeError('旧密码错误');
      return;
    }
    if (newPasswordForm.newPassword !== newPasswordForm.confirmPassword) {
      setPasswordChangeError('新密码与确认密码不一致');
      return;
    }
    if (newPasswordForm.newPassword.length < 6) {
      setPasswordChangeError('新密码长度至少为 6 位');
      return;
    }

    const updated = { ...credentials, password: newPasswordForm.newPassword };
    setCredentials(updated);
    localStorage.setItem(STORAGE_KEY_PASSWORD, updated.password);
    
    setPasswordChangeSuccess('密码修改成功！系统已为您生成备忘文件。');
    setPasswordChangeError('');
    setNewPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });

    const content = `账号：${updated.username}\n新密码：${updated.password}\n修改日期：${new Date().toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '密码备忘.txt';
    link.click();
  };

  const handleBackup = () => {
    const backupData = {
      entries,
      referencePrices,
      reductionRate,
      vendors,
      monthlyReports,
      recipes,
      weeklyMenus,
      version: '4.0 (Physical Grid + Recipes)',
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `食堂数据备份_${new Date().toLocaleDateString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      await dbService.clearAll();
      if (data.entries) await dbService.bulkSaveEntries(data.entries);
      if (data.referencePrices) await dbService.bulkSaveReferencePrices(data.referencePrices);
      if (data.reductionRate) await dbService.saveSetting('reductionRate', data.reductionRate);
      if (data.vendors) for (const v of data.vendors) await dbService.saveVendor(v);
      if (data.monthlyReports) for (const r of data.monthlyReports) await dbService.saveReport(r);
      if (data.recipes) for (const rec of data.recipes) await dbService.saveRecipe(rec);
      if (data.weeklyMenus) for (const m of data.weeklyMenus) await dbService.saveWeeklyMenu(m);
      
      alert('数据恢复成功！系统即将重载。');
      window.location.reload();
    } catch (err) {
      alert('无效的备份文件，恢复失败。');
    }
  };

  const handleClearAll = async () => {
    localStorage.removeItem(STORAGE_KEY_AUTH);
    await dbService.clearAll();
    alert('系统已清空，数据已初始化。系统即将重载。');
    window.location.reload();
  };

  const priceRecords = useMemo(() => computePriceRecords(entries), [entries]);
  const uniqueProducts = useMemo(() => Array.from(new Set(entries.map(e => e.productName))).sort(), [entries]);

  if (isAppLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-blue-500 animate-pulse" />
          </div>
        </div>
        <div className="mt-8 text-center">
          <h2 className="text-xl font-black text-white tracking-widest uppercase">数据库加载中</h2>
          <p className="text-slate-500 text-xs font-bold mt-2">正在准备高强度本地存储环境...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] pointer-events-none"></div>
        <div className="w-full max-w-md relative">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 pt-12 pb-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mx-auto mb-6 transition-transform hover:scale-110 duration-500">
                <Lock className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">安全登录</h1>
              <p className="text-slate-400 text-sm font-bold">食堂财务管理系统 · 增强版</p>
            </div>

            <form onSubmit={handleLogin} className="px-8 pb-12 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">管理账号</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input 
                    type="text" 
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold transition-all placeholder:text-slate-600"
                    placeholder="请输入登录账号"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">安全密码</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input 
                    type="password" 
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-bold transition-all placeholder:text-slate-600"
                    placeholder="请输入登录密码"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-red-500/10 border-2 border-red-500/20 rounded-xl p-4 text-red-400 text-sm font-black flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  {loginError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-slate-950 font-black rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all transform duration-200 mt-4 tracking-widest uppercase"
              >
                进入系统
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f1f5f9] text-[#0f172a] font-sans overflow-hidden">
      <aside className="w-[260px] bg-white flex flex-col shrink-0 z-10 shadow-xl relative overflow-hidden border-r border-slate-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        
        <div className="px-8 py-10 relative">
          <div className="flex items-center gap-3 text-slate-900 mb-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <span className="font-black text-xl tracking-tighter text-slate-950">食堂财务专业版</span>
          </div>
          <p className="text-slate-400 text-[10px] uppercase font-black tracking-[0.3em] ml-13">SQL-PRO CORE v4.0</p>
        </div>
        
        <nav className="flex flex-col px-4 gap-1.5 flex-1 relative overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 opacity-70">数据录入</div>
          <button onClick={() => setActiveTab('entry')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'entry' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <ClipboardList className="w-5 h-5" />
            <span>单据录入</span>
          </button>
          <button onClick={() => setActiveTab('recipe-menu')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'recipe-menu' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <FileBarChart className="w-5 h-5" />
            <span>菜谱周谱</span>
          </button>
          
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 mt-4 opacity-70">分析报表</div>
          <button onClick={() => setActiveTab('price')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'price' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <TrendingUp className="w-5 h-5" />
            <span>变动分析</span>
          </button>
          <button onClick={() => setActiveTab('trend')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'trend' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <LineChartIcon className="w-5 h-5" />
            <span>走势报告</span>
          </button>
          <button onClick={() => setActiveTab('inventory')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'inventory' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <Package className="w-5 h-5" />
            <span>库存储备</span>
          </button>
          <button onClick={() => setActiveTab('monthly-report')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'monthly-report' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <FileBarChart className="w-5 h-5" />
            <span>运行统计</span>
          </button>
          <button onClick={() => setActiveTab('annual-summary')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'annual-summary' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <PieChart className="w-5 h-5" />
            <span>年终总结</span>
          </button>

          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 mt-4 opacity-70">价格审计</div>
          <button onClick={() => setActiveTab('reference')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'reference' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <Tag className="w-5 h-5" />
            <span>基准定价</span>
          </button>
          <button onClick={() => setActiveTab('audit')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'audit' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <ShieldCheck className="w-5 h-5" />
            <span>合规审计</span>
          </button>
          
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 mt-4 opacity-70">供应链</div>
          <button onClick={() => setActiveTab('vendor-comparison')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'vendor-comparison' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <ArrowLeftRight className="w-5 h-5" />
            <span>供货比价</span>
          </button>
          <button onClick={() => setActiveTab('vendors')} className={cn("px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all duration-200 group active:scale-95", activeTab === 'vendors' ? 'bg-blue-600 text-slate-950 shadow-lg shadow-blue-100' : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/50')}>
            <Truck className="w-5 h-5" />
            <span>供应商库</span>
          </button>

          <div className="mt-auto mb-4">
             <button onClick={() => setActiveTab('settings')} className={cn("w-full px-4 py-3 flex items-center gap-3 font-black rounded-xl transition-all group border-2", activeTab === 'settings' ? 'bg-blue-600 text-slate-950 border-blue-600 shadow-xl scale-105' : 'text-slate-600 border-slate-100 hover:text-blue-600 hover:border-blue-100')}>
              <Settings className="w-5 h-5" />
              <span>系统设置</span>
            </button>
          </div>
        </nav>

        <div className="px-5 py-6 mt-auto bg-slate-50 border-t-2 border-slate-100">
           <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">账号：{credentials.username}</span>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-all" title="登出">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <label className="block text-[9px] font-black text-slate-400 uppercase mb-2">开票下浮比例</label>
            <div className="flex items-center gap-2">
              <input type="number" value={reductionRate} onChange={(e) => handleUpdateReductionRate(Number(e.target.value))} min="0" max="100" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-600" />
              <span className="text-blue-600 font-black">%</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-auto bg-slate-100 relative custom-scrollbar">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] pointer-events-none"></div>
        <div className="flex-1 flex flex-col p-8 gap-8 max-w-7xl mx-auto w-full relative z-10">
          {activeTab === 'entry' && <EntryTab entries={entries} addEntry={addEntry} addEntries={addEntries} deleteEntry={deleteEntry} referencePrices={referencePrices} vendors={vendors} />}
          {activeTab === 'price' && <PriceHistoryTab records={priceRecords} />}
          {activeTab === 'trend' && <TrendTab entries={entries} referencePrices={referencePrices} />}
          {activeTab === 'inventory' && <InventoryTab entries={entries} reductionRate={reductionRate} />}
          {activeTab === 'reference' && <ReferencePriceTab referencePrices={referencePrices} updateReferencePrice={updateReferencePrice} bulkUpdateReferencePrices={bulkUpdateReferencePrices} uniqueProducts={uniqueProducts} />}
          {activeTab === 'audit' && <BenchmarkAuditTab entries={entries} />}
          {activeTab === 'vendor-comparison' && <VendorComparisonTab entries={entries} vendors={vendors} />}
          {activeTab === 'vendors' && <VendorManagementTab vendors={vendors} addVendor={addVendor} updateVendor={updateVendor} deleteVendor={deleteVendor} />}
          {activeTab === 'annual-summary' && <AnnualSummaryTab entries={entries} reductionRate={reductionRate} />}
          {activeTab === 'monthly-report' && <MonthlyReportTab entries={entries} reductionRate={reductionRate} reports={monthlyReports} onSaveReport={addOrUpdateReport} />}
          {activeTab === 'recipe-menu' && <RecipeMenuTab recipes={recipes} weeklyMenus={weeklyMenus} onSaveRecipe={addOrUpdateRecipe} onDeleteRecipe={deleteRecipe} onSaveWeeklyMenu={addOrUpdateWeeklyMenu} />}
          {activeTab === 'settings' && <DataManagementTab username={credentials.username} onBackup={handleBackup} onRestore={handleRestore} onClearAll={handleClearAll} onOpenPasswordModal={() => setIsChangingPassword(true)} />}
        </div>
      </main>

      {isChangingPassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setIsChangingPassword(false)}></div>
          <div className="bg-slate-900 w-full max-w-sm rounded-[2rem] border-2 border-slate-800 shadow-2xl relative z-10 p-10 animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                <ShieldCheck className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-black text-white">安全中心</h3>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" placeholder="当前密码" required value={newPasswordForm.oldPassword} onChange={(e) => setNewPasswordForm({ ...newPasswordForm, oldPassword: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none" />
              <input type="password" placeholder="新设密码" required value={newPasswordForm.newPassword} onChange={(e) => setNewPasswordForm({ ...newPasswordForm, newPassword: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none" />
              <input type="password" placeholder="确认新密码" required value={newPasswordForm.confirmPassword} onChange={(e) => setNewPasswordForm({ ...newPasswordForm, confirmPassword: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none" />
              {passwordChangeError && <div className="text-red-400 text-[10px] font-black p-2 bg-red-500/10 rounded-lg">{passwordChangeError}</div>}
              {passwordChangeSuccess && <div className="text-emerald-400 text-[10px] font-black p-2 bg-emerald-500/10 rounded-lg">{passwordChangeSuccess}</div>}
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setIsChangingPassword(false)} className="flex-1 py-3 bg-slate-800 text-slate-400 font-bold rounded-xl">取消</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-slate-950 font-black rounded-xl">确认修改</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
