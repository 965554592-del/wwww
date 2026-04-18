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
import { Entry, Vendor, MonthlyReport } from './types';
import { computePriceRecords } from './lib/dataUtils';
import { ClipboardList, TrendingUp, Package, Tag, PieChart, Wallet, LineChart as LineChartIcon, ShieldCheck, Truck, ArrowLeftRight, FileBarChart, Lock, User, LogOut } from 'lucide-react';

const STORAGE_KEY_ENTRIES = 'cafeteria_entries';
const STORAGE_KEY_REF_PRICES = 'cafeteria_ref_prices';
const STORAGE_KEY_REDUCTION_RATE = 'cafeteria_reduction_rate';
const STORAGE_KEY_VENDORS = 'cafeteria_vendors';
const STORAGE_KEY_REPORTS = 'cafeteria_reports';
const STORAGE_KEY_AUTH = 'cafeteria_auth_state';
const STORAGE_KEY_USERNAME = 'cafeteria_username';
const STORAGE_KEY_PASSWORD = 'cafeteria_password';

export default function App() {
  const [credentials, setCredentials] = useState({
    username: localStorage.getItem(STORAGE_KEY_USERNAME) || 'YDJY123',
    password: localStorage.getItem(STORAGE_KEY_PASSWORD) || '12345678'
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AUTH) === 'true';
    } catch {
      return false;
    }
  });

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPasswordForm, setNewPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');

  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENTRIES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [reductionRate, setReductionRate] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REDUCTION_RATE);
      return stored ? parseFloat(stored) : 17;
    } catch {
      return 17;
    }
  });

  const [referencePrices, setReferencePrices] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REF_PRICES);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VENDORS);
      return stored ? JSON.parse(stored) : [
        { id: 'v1', name: '供应商A', isPreferred: true },
        { id: 'v2', name: '供应商B' }
      ];
    } catch {
      return [];
    }
  });

  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REPORTS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'entry' | 'price' | 'inventory' | 'reference' | 'annual-summary' | 'trend' | 'audit' | 'vendors' | 'vendor-comparison' | 'monthly-report'>('entry');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REF_PRICES, JSON.stringify(referencePrices));
  }, [referencePrices]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REDUCTION_RATE, reductionRate.toString());
  }, [reductionRate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VENDORS, JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(monthlyReports));
  }, [monthlyReports]);

  const addEntry = (entry: Entry) => {
    setEntries((prev) => [...prev, entry]);
  };

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const updateReferencePrice = (name: string, price: number | null) => {
    setReferencePrices(prev => {
      const copy = { ...prev };
      if (price === null) {
        delete copy[name];
      } else {
        copy[name] = price;
      }
      return copy;
    });
  };

  const bulkUpdateReferencePrices = (newPrices: Record<string, number>) => {
    setReferencePrices(prev => ({ ...prev, ...newPrices }));
  };

  const addVendor = (vendor: Vendor) => {
    setVendors(prev => [...prev, vendor]);
  };

  const deleteVendor = (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  const updateVendor = (updated: Vendor) => {
    setVendors(prev => prev.map(v => v.id === updated.id ? updated : v));
  };

  const addOrUpdateReport = (report: MonthlyReport) => {
    setMonthlyReports(prev => {
      const exists = prev.find(r => r.periodName === report.periodName);
      if (exists) {
        return prev.map(r => r.periodName === report.periodName ? report : r);
      }
      return [...prev, report];
    });
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
    
    setPasswordChangeSuccess('密码修改成功！系统已为您生成备份文件，建议您将其保存至：C:\\餐饮管理密码\\');
    setPasswordChangeError('');
    setNewPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });

    // Auto download a reminder file
    const content = `餐饮管理系统管理凭证\n\n账号：${updated.username}\n新密码：${updated.password}\n修改日期：${new Date().toLocaleString()}\n\n请务必将此文件保存至 C:\\餐饮管理密码 目录下以便备忘。`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '餐饮管理密码备忘.txt';
    link.click();
  };

  const priceRecords = useMemo(() => computePriceRecords(entries), [entries]);
  const uniqueProducts = useMemo(() => Array.from(new Set(entries.map(e => e.productName))).sort(), [entries]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05] pointer-events-none"></div>
        
        {/* Animated background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md relative">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-8 pt-12 pb-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mx-auto mb-6">
                <Lock className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-display font-black text-white tracking-tight mb-2">安全登录</h1>
              <p className="text-slate-400 text-sm font-medium">食堂财务管理系统 · 专业版</p>
            </div>

            <form onSubmit={handleLogin} className="px-8 pb-12 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">管理账号</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input 
                    type="text" 
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-600"
                    placeholder="请输入登录账号"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">安全密码</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input 
                    type="password" 
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-600"
                    placeholder="请输入登录密码"
                  />
                </div>
              </div>

              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm font-medium flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                  {loginError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all transform duration-200 mt-4 h-14"
              >
                进入系统
              </button>
            </form>
          </div>
          
          <p className="text-center mt-8 text-slate-500 text-xs font-medium">
            © 2026 食堂财务管理系统 | 内部专用
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] text-[#1e293b] font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-[260px] bg-[#0f172a] flex flex-col shrink-0 z-10 shadow-2xl relative overflow-hidden">
        {/* Abstract background blobs for a premium feel */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none"></div>

        <div className="px-8 py-10 relative">
          <div className="flex items-center gap-3 text-white mb-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">食堂财务系统</span>
          </div>
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] ml-13">Accounting Pro v2.0</p>
        </div>
        
        <nav className="flex flex-col px-4 gap-1.5 flex-1 relative">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-2">主要功能</div>
          <button
            onClick={() => setActiveTab('entry')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'entry'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <ClipboardList className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'entry' ? 'text-white' : 'text-slate-500'}`} />
            <span>单据录入</span>
          </button>
          <button
            onClick={() => setActiveTab('price')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'price'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <TrendingUp className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'price' ? 'text-white' : 'text-slate-500'}`} />
            <span>价格变动分析</span>
          </button>
          <button
            onClick={() => setActiveTab('trend')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'trend'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <LineChartIcon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'trend' ? 'text-white' : 'text-slate-500'}`} />
            <span>价格走势深度报告</span>
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <Package className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'inventory' ? 'text-white' : 'text-slate-500'}`} />
            <span>出入库统计</span>
          </button>
          <button
            onClick={() => setActiveTab('reference')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'reference'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <Tag className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'reference' ? 'text-white' : 'text-slate-500'}`} />
            <span>市场基准价</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <ShieldCheck className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'audit' ? 'text-white' : 'text-slate-500'}`} />
            <span>基准价审计分析</span>
          </button>
          <button
            onClick={() => setActiveTab('vendor-comparison')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'vendor-comparison'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <ArrowLeftRight className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'vendor-comparison' ? 'text-white' : 'text-slate-500'}`} />
            <span>供应商价格对比</span>
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'vendors'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <Truck className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'vendors' ? 'text-white' : 'text-slate-500'}`} />
            <span>供应商库管理</span>
          </button>
          <button
            onClick={() => setActiveTab('monthly-report')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'monthly-report'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <FileBarChart className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'monthly-report' ? 'text-white' : 'text-slate-500'}`} />
            <span>运行情况统计表</span>
          </button>
          <button
            onClick={() => setActiveTab('annual-summary')}
            className={`px-4 py-3 flex items-center gap-3 font-semibold rounded-xl transition-all duration-200 group ${
              activeTab === 'annual-summary'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 active:scale-95'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 active:scale-95'
            }`}
          >
            <PieChart className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${activeTab === 'annual-summary' ? 'text-white' : 'text-slate-500'}`} />
            <span>全年采购总结</span>
          </button>
        </nav>

        <div className="px-5 py-8 mt-auto relative bg-[#1e293b]/30 backdrop-blur-sm border-t border-slate-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">管理员操作</span>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all active:scale-95"
                title="修改密码"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all active:scale-95"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 shadow-inner group transition-all duration-300 hover:border-blue-500/50">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 group-hover:text-blue-400 transition-colors">默认下浮比例 (0-100%)</label>
            <div className="flex items-center gap-3">
              <input 
                type="number" 
                value={reductionRate}
                onChange={(e) => setReductionRate(Number(e.target.value))}
                min="0"
                max="100"
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
              <span className="text-blue-500 font-black text-lg">%</span>
            </div>
            <p className="mt-3 text-[9px] text-slate-500 leading-normal font-medium italic">
              调整此数值将同步刷新报表中“下浮金额”的计算权重。
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-auto bg-slate-50/50 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
        <div className="flex-1 flex flex-col p-8 gap-8 max-w-7xl mx-auto w-full relative z-10">
          {activeTab === 'entry' && (
            <EntryTab 
              entries={entries} 
              addEntry={addEntry} 
              deleteEntry={deleteEntry} 
              referencePrices={referencePrices} 
              vendors={vendors}
            />
          )}
          
          {activeTab === 'price' && (
            <PriceHistoryTab records={priceRecords} />
          )}

          {activeTab === 'trend' && (
            <TrendTab entries={entries} referencePrices={referencePrices} />
          )}
          
          {activeTab === 'inventory' && (
            <InventoryTab entries={entries} reductionRate={reductionRate} />
          )}

          {activeTab === 'reference' && (
            <ReferencePriceTab 
              referencePrices={referencePrices} 
              updateReferencePrice={updateReferencePrice} 
              bulkUpdateReferencePrices={bulkUpdateReferencePrices} 
              uniqueProducts={uniqueProducts}
            />
          )}

          {activeTab === 'audit' && (
            <BenchmarkAuditTab entries={entries} />
          )}

          {activeTab === 'vendor-comparison' && (
            <VendorComparisonTab entries={entries} vendors={vendors} />
          )}

          {activeTab === 'vendors' && (
            <VendorManagementTab vendors={vendors} addVendor={addVendor} updateVendor={updateVendor} deleteVendor={deleteVendor} />
          )}

          {activeTab === 'annual-summary' && (
            <AnnualSummaryTab entries={entries} reductionRate={reductionRate} />
          )}

          {activeTab === 'monthly-report' && (
            <MonthlyReportTab 
              entries={entries} 
              reductionRate={reductionRate} 
              reports={monthlyReports}
              onSaveReport={addOrUpdateReport}
            />
          )}
        </div>
        <footer className="text-center text-slate-500 text-sm py-4">
          系统所有数据均自动保存在您的浏览器本地，不上传服务器。
        </footer>
      </main>

      {/* Change Password Modal */}
      {isChangingPassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm" onClick={() => { setIsChangingPassword(false); setPasswordChangeSuccess(''); setPasswordChangeError(''); }}></div>
          <div className="bg-[#1e293b] w-full max-w-sm rounded-3xl border border-slate-700 shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="px-8 pt-10 pb-6 text-center">
              <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white">安全中心 - 修改密码</h3>
              <p className="text-slate-500 text-xs mt-1">账号：{credentials.username}</p>
            </div>

            <form onSubmit={handleChangePassword} className="px-8 pb-10 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">当前密码</label>
                <input 
                  type="password"
                  required
                  value={newPasswordForm.oldPassword}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, oldPassword: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">新设密码</label>
                <input 
                  type="password"
                  required
                  value={newPasswordForm.newPassword}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, newPassword: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">确认新密码</label>
                <input 
                  type="password"
                  required
                  value={newPasswordForm.confirmPassword}
                  onChange={(e) => setNewPasswordForm({ ...newPasswordForm, confirmPassword: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>

              {passwordChangeError && (
                <div className="text-red-400 text-[10px] font-bold text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                  ⚠ {passwordChangeError}
                </div>
              )}
              
              {passwordChangeSuccess && (
                <div className="text-emerald-400 text-[10px] font-bold text-center bg-emerald-500/10 py-3 rounded-lg border border-emerald-500/20 px-2 leading-relaxed">
                  ✓ {passwordChangeSuccess}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordChangeSuccess('');
                      setPasswordChangeError('');
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/40 active:scale-95 transition-all"
                >
                  确认修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
