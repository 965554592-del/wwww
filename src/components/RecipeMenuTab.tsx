import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, WeeklyMenu, RecipeCategory, DayMenu, MenuItem } from '../types';
import { Plus, Trash2, Edit2, Save, X, Utensils, Zap, Sparkles, Filter, ChevronRight, ChevronLeft, Download, Printer, BrainCircuit, Loader2, MessageSquareText, Star, FileBarChart, Calendar, ArrowUpDown, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { aiService } from '../services/aiService';

interface RecipeMenuTabProps {
  recipes: Recipe[];
  weeklyMenus: WeeklyMenu[];
  onSaveRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (id: string) => void;
  onSaveWeeklyMenu: (menu: WeeklyMenu) => void;
}

const CATEGORY_MAP: Record<RecipeCategory, { label: string; color: string; pillColor: string }> = {
  staple: { label: '主食', color: 'bg-orange-500', pillColor: 'bg-orange-50 border-orange-200 text-orange-900' },
  meat: { label: '肉类', color: 'bg-red-500', pillColor: 'bg-red-50 border-red-200 text-red-900' },
  vegetable: { label: '素菜', color: 'bg-emerald-500', pillColor: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
  soup: { label: '汤品', color: 'bg-cyan-500', pillColor: 'bg-cyan-50 border-cyan-200 text-cyan-900' },
  coarse_grain: { label: '杂粮', color: 'bg-amber-600', pillColor: 'bg-amber-50 border-amber-200 text-amber-900' },
  breakfast: { label: '早餐', color: 'bg-yellow-400', pillColor: 'bg-yellow-50 border-yellow-200 text-yellow-900' },
  lunch: { label: '午餐', color: 'bg-blue-500', pillColor: 'bg-blue-50 border-blue-200 text-blue-900' },
  fruit: { label: '水果', color: 'bg-pink-500', pillColor: 'bg-pink-50 border-pink-200 text-pink-900' },
  other: { label: '其它', color: 'bg-slate-500', pillColor: 'bg-slate-50 border-slate-200 text-slate-900' },
};

const NUTRITION_OPTIONS = ['高蛋白', '高纤维', '多维素', '低脂', '易消化', '能量餐'];

export default function RecipeMenuTab({ recipes, weeklyMenus, onSaveRecipe, onDeleteRecipe, onSaveWeeklyMenu }: RecipeMenuTabProps) {
  const [subTab, setSubTab] = useState<'library' | 'menu' | 'history'>('menu');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [recipeFilter, setRecipeFilter] = useState<RecipeCategory | 'all'>('all');
  const [historySortOrder, setHistorySortOrder] = useState<'date-desc' | 'date-asc' | 'budget-desc' | 'budget-asc'>('date-desc');

  // AI States
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Partial<Recipe>[]>([]);
  const [aiAuditReport, setAiAuditReport] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');

  const [activeWeekId, setActiveWeekId] = useState<string>(() => {
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    return sunday.toISOString().split('T')[0];
  });

  const [budgetLimit, setBudgetLimit] = useState<number>(25);

  const getFallbackMenu = (weekId: string, limit: number) => ({
    weekId,
    days: Array(7).fill(null).map(() => ({
      breakfast: { recipeIds: [] },
      lunch: { recipeIds: [] },
      dinner: { recipeIds: [] }
    })),
    budgetPerDay: limit
  });

  const [draftMenu, setDraftMenu] = useState<WeeklyMenu>(getFallbackMenu(activeWeekId, budgetLimit));

  // Sync draft from weeklyMenus when activeWeekId changes
  useEffect(() => {
    const found = weeklyMenus.find(m => m.weekId === activeWeekId);
    if (found) {
      setDraftMenu(JSON.parse(JSON.stringify(found)));
    } else {
      setDraftMenu(getFallbackMenu(activeWeekId, budgetLimit));
    }
  }, [activeWeekId, weeklyMenus]);

  const [draggedItem, setDraggedItem] = useState<{ dayIndex: number, meal: keyof DayMenu, recipeIndex: number, recipeId: string } | null>(null);

  const handleDragStart = (e: React.DragEvent, dayIndex: number, meal: keyof DayMenu, recipeIndex: number, recipeId: string) => {
    setDraggedItem({ dayIndex, meal, recipeIndex, recipeId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDayIndex: number, targetMeal: keyof DayMenu, targetRecipeIndex?: number) => {
    e.preventDefault();
    if (!draggedItem) return;
    
    // Create deep copy
    const newDays = JSON.parse(JSON.stringify(draftMenu.days)) as DayMenu[];
    
    const srcIds = newDays[draggedItem.dayIndex][draggedItem.meal].recipeIds;
    srcIds.splice(draggedItem.recipeIndex, 1);
    
    const targetIds = newDays[targetDayIndex][targetMeal].recipeIds;
    if (targetRecipeIndex !== undefined) {
      targetIds.splice(targetRecipeIndex, 0, draggedItem.recipeId);
    } else {
      targetIds.push(draggedItem.recipeId);
    }

    setDraftMenu(prev => ({ ...prev, days: newDays }));
    setDraggedItem(null);
  };

  const saveDraftMenu = () => {
    onSaveWeeklyMenu({ ...draftMenu, budgetPerDay: budgetLimit });
    alert("已保存对排菜谱的修改留档！");
  };

  const handleRemoveFromMenu = (dayIndex: number, meal: keyof DayMenu, rIndex: number) => {
    const newDays = JSON.parse(JSON.stringify(draftMenu.days)) as DayMenu[];
    newDays[dayIndex][meal].recipeIds.splice(rIndex, 1);
    setDraftMenu(prev => ({ ...prev, days: newDays }));
  };

  const [recipeSelectorTarget, setRecipeSelectorTarget] = useState<{ dayIndex: number, meal: keyof DayMenu, replaceIndex?: number } | null>(null);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('');

  const onSelectRecipeForMenu = (recipeId: string) => {
    if (!recipeSelectorTarget) return;
    const newDays = JSON.parse(JSON.stringify(draftMenu.days)) as DayMenu[];
    const targetIds = newDays[recipeSelectorTarget.dayIndex][recipeSelectorTarget.meal].recipeIds;
    if (recipeSelectorTarget.replaceIndex !== undefined) {
      targetIds[recipeSelectorTarget.replaceIndex] = recipeId;
    } else {
      targetIds.push(recipeId);
    }
    setDraftMenu(prev => ({ ...prev, days: newDays }));
    setRecipeSelectorTarget(null);
    setRecipeSearchTerm('');
  };

  const filteredRecipes = useMemo(() => {
    if (recipeFilter === 'all') return recipes;
    return recipes.filter(r => {
      const cats = Array.isArray(r.category) ? r.category : [r.category];
      return cats.includes(recipeFilter);
    });
  }, [recipes, recipeFilter]);

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecipe) {
      onSaveRecipe(editingRecipe);
      setEditingRecipe(null);
      setIsAddingRecipe(false);
    }
  };

  const startEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setIsAddingRecipe(true);
  };

  const startNewRecipe = () => {
    setEditingRecipe({
      id: crypto.randomUUID(),
      name: '',
      category: ['vegetable'],
      estimatedCost: 0,
      rating: 0,
      nutritionTags: [],
      ingredients: [],
      description: ''
    });
    setIsAddingRecipe(true);
  };

  const [isGeneratingMenu, setIsGeneratingMenu] = useState(false);

  // 生成算法
  const autoGenerateMenu = async () => {
    setIsGeneratingMenu(true);
    try {
      const generatedData = await aiService.generateWeeklyMenu(recipes, budgetLimit);
      if (generatedData && generatedData.days && generatedData.days.length === 7) {
        const generatedDraft = {
          ...draftMenu,
          days: generatedData.days,
          budgetPerDay: budgetLimit
        };
        setDraftMenu(generatedDraft);
        onSaveWeeklyMenu(generatedDraft);
      } else {
        alert("AI生成结构不完整，请重试或补充菜谱库。");
      }
    } catch (e) {
      console.error(e);
      alert("AI 生成周谱失败，请检查网络或大模型配置。");
    } finally {
      setIsGeneratingMenu(false);
    }
  };

  const handleAISuggest = async () => {
    if (!aiPrompt.trim()) return;
    setIsAIThinking(true);
    try {
      const suggestions = await aiService.suggestRecipes(aiPrompt);
      setAiSuggestions(suggestions);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAIThinking(false);
    }
  };

  const handleAIAudit = async () => {
    setIsAIThinking(true);
    setAiAuditReport(null);
    try {
      const report = await aiService.optimizeWeeklyMenu(draftMenu, recipes, budgetLimit);
      setAiAuditReport(report);
    } catch (e) {
      console.error(e);
      setAiAuditReport("AI 审计暂时不可用，请稍后再试。");
    } finally {
      setIsAIThinking(false);
    }
  };

  const adoptAISuggestion = (suggestion: Partial<Recipe>) => {
    const newRecipe: Recipe = {
      id: crypto.randomUUID(),
      name: suggestion.name || '未命名菜名',
      category: suggestion.category ? (Array.isArray(suggestion.category) ? suggestion.category : [suggestion.category]) : ['vegetable'],
      estimatedCost: suggestion.estimatedCost || 0,
      rating: suggestion.rating || 0,
      nutritionTags: suggestion.nutritionTags || [],
      ingredients: suggestion.ingredients || [],
      description: suggestion.description || ''
    };
    onSaveRecipe(newRecipe);
    setAiSuggestions(prev => prev.filter(s => s.name !== suggestion.name));
  };

  const calculateDayCost = (dayIndex: number) => {
    const day = draftMenu.days[dayIndex];
    if (!day) return 0;
    const allRecipeIds = [...day.breakfast.recipeIds, ...day.lunch.recipeIds, ...day.dinner.recipeIds];
    return allRecipeIds.reduce((sum, id) => {
      const r = recipes.find(rec => rec.id === id);
      return sum + (r?.estimatedCost || 0);
    }, 0);
  };

  return (
    <div className="flex flex-col gap-8 w-full font-sans">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black text-slate-950 tracking-tight flex items-center gap-3">
            <Utensils className="w-8 h-8 text-indigo-600" />
            菜谱库与智能周谱
          </h1>
          <p className="text-slate-500 font-bold">科学配餐，预控成本，提升职工就餐满意度。</p>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto whitespace-nowrap">
          <button 
            onClick={() => setSubTab('menu')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2",
              subTab === 'menu' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Sparkles className="w-4 h-4" />
            周谱生成器
          </button>
          <button 
            onClick={() => setSubTab('library')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2",
              subTab === 'library' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Plus className="w-4 h-4" />
            菜谱管理
          </button>
          <button 
            onClick={() => setSubTab('history')}
            className={cn(
              "px-6 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2",
              subTab === 'history' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <FileBarChart className="w-4 h-4" />
            历史档案
          </button>
        </div>
      </header>

      {subTab === 'library' ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
              <button 
                onClick={() => setRecipeFilter('all')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap",
                  recipeFilter === 'all' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                全部
              </button>
              {(Object.keys(CATEGORY_MAP) as RecipeCategory[]).map(cat => (
                <button 
                  key={cat}
                  onClick={() => setRecipeFilter(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-2",
                    recipeFilter === cat ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", CATEGORY_MAP[cat].color)}></span>
                  {CATEGORY_MAP[cat].label}
                </button>
              ))}
            </div>
            
            <button 
              onClick={startNewRecipe}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2 shrink-0"
            >
              <Plus className="w-5 h-5" />
              新增菜谱
            </button>
          </div>

          {/* AI Recipe Generator Section */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-[2.5rem] p-8 border-4 border-indigo-500/30 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-1000"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                   <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
                     <BrainCircuit className="w-8 h-8 text-indigo-400" />
                   </div>
                   <div>
                     <div className="flex items-center gap-2">
                       <h2 className="text-2xl font-black text-white">AI 智能菜谱灵感</h2>
                       <span className="px-2 py-0.5 bg-indigo-500/30 border border-indigo-500/50 rounded-full text-[10px] font-black text-indigo-300 uppercase letter-spacing-widest">
                         {import.meta.env.VITE_AI_MODE === 'china' ? '国内版' : '国际版'}
                       </span>
                     </div>
                     <p className="text-indigo-200/60 text-sm font-bold">告知 AI 您的需求（如：帮我设计几道适合春季的低成本高蛋白菜谱）</p>
                   </div>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAISuggest()}
                    placeholder="输入您的配餐需求..."
                    className="flex-1 bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-5 text-white font-bold focus:border-indigo-500 focus:bg-white/10 outline-none transition-all placeholder:text-slate-500"
                  />
                  <button 
                    onClick={handleAISuggest}
                    disabled={isAIThinking || !aiPrompt.trim()}
                    className="bg-indigo-500 text-white px-8 py-5 rounded-2xl font-black hover:bg-indigo-400 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAIThinking ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    魔法生成
                  </button>
                </div>
              </div>

              {aiSuggestions.length > 0 && (
                <div className="w-full md:w-80 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                   <div className="flex items-center justify-between mb-4">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI 推荐预览</span>
                     <button onClick={() => setAiSuggestions([])} className="text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                   </div>
                   <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                     {aiSuggestions.map((s, i) => (
                       <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group/item hover:bg-white/10 transition-all">
                         <div className="flex flex-col">
                           <span className="text-sm font-black text-white">{s.name}</span>
                           <span className="text-[10px] text-indigo-300 font-bold">¥{s.estimatedCost?.toFixed(1)} /人</span>
                         </div>
                         <button 
                          onClick={() => adoptAISuggestion(s)}
                          className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500 hover:text-white transition-all scale-0 group-hover/item:scale-100 shadow-lg"
                         >
                           <Plus className="w-4 h-4" />
                         </button>
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredRecipes.map((recipe) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={recipe.id}
                  className="bg-white rounded-[2rem] border-2 border-slate-200 shadow-sm overflow-hidden group hover:border-indigo-400 transition-all p-6 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(recipe.category) ? recipe.category : [recipe.category]).map(cat => (
                        <span key={cat} className={cn("px-3 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-wider", CATEGORY_MAP[cat]?.color || "bg-slate-500")}>
                          {CATEGORY_MAP[cat]?.label || cat}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditRecipe(recipe)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteRecipe(recipe.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">{recipe.name}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={cn("w-4 h-4", (recipe.rating || 0) >= star ? "text-amber-400 fill-amber-400" : "text-slate-200")} 
                      />
                    ))}
                    <span className="text-xs font-bold text-slate-400 ml-1">食客真实反馈: {recipe.rating || 0} 分</span>
                  </div>
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {recipe.nutritionTags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-black border border-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase">预估成本</span>
                      <span className="text-lg font-black text-indigo-600">¥ {recipe.estimatedCost.toFixed(2)} /人</span>
                    </div>
                    <div className="text-xs font-bold text-slate-400">
                      {recipe.ingredients.length} 种配料
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : subTab === 'history' ? (
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileBarChart className="w-6 h-6 text-indigo-600" />
              历史排菜档案
            </h2>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-200">
              <button
                onClick={() => setHistorySortOrder(prev => prev === 'date-desc' ? 'date-asc' : 'date-desc')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                  historySortOrder.startsWith('date') ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Calendar className="w-4 h-4" />
                时间 {historySortOrder.startsWith('date') && (historySortOrder.endsWith('desc') ? '↓' : '↑')}
              </button>
              <button
                onClick={() => setHistorySortOrder(prev => prev === 'budget-desc' ? 'budget-asc' : 'budget-desc')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                  historySortOrder.startsWith('budget') ? "bg-white text-slate-900 shadow-sm border border-slate-200/50" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ArrowUpDown className="w-4 h-4" />
                预算 {historySortOrder.startsWith('budget') && (historySortOrder.endsWith('desc') ? '↓' : '↑')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {weeklyMenus.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                暂无历史菜单数据。在"周谱生成器"生成并保存即可在此时留存档案。
              </div>
            ) : (
              [...weeklyMenus].sort((a, b) => {
                if (historySortOrder === 'date-desc') return new Date(b.weekId).getTime() - new Date(a.weekId).getTime();
                if (historySortOrder === 'date-asc') return new Date(a.weekId).getTime() - new Date(b.weekId).getTime();
                if (historySortOrder === 'budget-desc') return b.budgetPerDay - a.budgetPerDay;
                if (historySortOrder === 'budget-asc') return a.budgetPerDay - b.budgetPerDay;
                return 0;
              }).map((menu) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={menu.weekId} 
                  className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-sm hover:border-indigo-300 transition-all group flex flex-col md:flex-row items-center justify-between gap-6"
                >
                  <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
                     <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border-2 border-indigo-100 flex-shrink-0">
                       <Calendar className="w-8 h-8 text-indigo-500" />
                     </div>
                     <div className="flex flex-col text-center md:text-left">
                       <h3 className="text-xl font-black text-slate-900">
                         {new Date(menu.weekId).toLocaleDateString()} — {new Date(new Date(menu.weekId).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                       </h3>
                       <p className="text-sm font-bold text-slate-500 mt-1">周谱编号: {menu.weekId}</p>
                     </div>
                  </div>

                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex flex-col items-end border-r-2 border-slate-100 pr-6">
                      <span className="text-[10px] font-black text-slate-400 uppercase">执行预算</span>
                      <span className="text-xl font-black text-slate-700">¥{menu.budgetPerDay} <span className="text-xs text-slate-400">/人</span></span>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveWeekId(menu.weekId);
                        setBudgetLimit(menu.budgetPerDay);
                        setSubTab('menu');
                      }}
                      className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-600 hover:text-white transition-all group-hover:shadow-md"
                    >
                      调取此周谱
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">

            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">查询日期</span>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => {
                    const d = new Date(activeWeekId);
                    d.setDate(d.getDate() - 7);
                    setActiveWeekId(d.toISOString().split('T')[0]);
                  }} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-5 h-5" /></button>
                  <div className="px-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-slate-900">
                    {new Date(activeWeekId).toLocaleDateString()} 一 {new Date(new Date(activeWeekId).getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </div>
                  <button onClick={() => {
                    const d = new Date(activeWeekId);
                    d.setDate(d.getDate() + 7);
                    setActiveWeekId(d.toISOString().split('T')[0]);
                  }} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronRight className="w-5 h-5" /></button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 justify-center">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase mb-2" title="按上月运行统计下浮金额平摊到总人次得出">每日单人预算上限 ⓘ</span>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="10" 
                    max="60" 
                    value={budgetLimit} 
                    onChange={(e) => setBudgetLimit(Number(e.target.value))}
                    className="w-32 accent-indigo-600"
                  />
                  <span className="text-xl font-black text-indigo-700 w-12">¥{budgetLimit}</span>
                </div>
              </div>

              <div className="h-12 w-[2px] bg-slate-100 hidden md:block"></div>

              <div className="flex flex-col items-center gap-2">
                 <div className="flex items-center gap-2">
                   <button 
                     onClick={autoGenerateMenu}
                     disabled={isGeneratingMenu}
                     className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 group active:scale-95 disabled:opacity-50 disabled:scale-100"
                   >
                     {isGeneratingMenu ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:animate-pulse" />}
                     {isGeneratingMenu ? 'AI 严格排菜中' : '自动生成周谱'}
                   </button>
                   <button 
                     onClick={saveDraftMenu}
                     className="bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2 active:scale-95"
                   >
                     <Save className="w-5 h-5" />
                     保存锁定周谱
                   </button>
                 </div>
                 <span className="text-[10px] text-slate-400 font-bold max-w-[300px] text-center leading-tight">
                   支持拖拽小框调换同餐段菜品。<br/>遵循配置 (四菜一汤、早禁粗粮)。周二/四/五下午定编配餐
                 </span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAIAudit}
                  disabled={isAIThinking}
                  className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl hover:bg-indigo-200 transition-all flex items-center gap-2 font-black text-xs active:scale-95 disabled:opacity-50" 
                  title="AI 营养与预算审计"
                >
                  {isAIThinking ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                  AI 审计周谱
                </button>
                <button className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all" title="打印菜谱"><Printer className="w-5 h-5" /></button>
                <button className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all" title="下载导出"><Download className="w-5 h-5" /></button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {aiAuditReport && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-indigo-50 border-2 border-indigo-200 rounded-[2.5rem] p-8 flex gap-6 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setAiAuditReport(null)} className="p-2 text-indigo-300 hover:text-indigo-600 transition-all"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-4 bg-indigo-600 text-white rounded-3xl h-fit">
                  <MessageSquareText className="w-8 h-8" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-black text-indigo-950">AI 营养与成本审计报告</h3>
                  <div className="text-indigo-900/80 font-bold leading-relaxed whitespace-pre-wrap">
                    {aiAuditReport}
                  </div>
                  <div className="pt-4 flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    <Sparkles className="w-3 h-3" /> 建议由专业营养师进一步审核
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-[3rem] border-2 border-slate-200 shadow-xl overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-bottom-2 border-slate-200">
                  <th className="p-6 bg-slate-50 border-r-2 border-slate-200 w-32"></th>
                  {['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'].map((day, i) => (
                    <th key={day} className="p-6 text-center border-r-2 border-slate-200 last:border-r-0">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-black text-slate-900">{day}</span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(new Date(activeWeekId).getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString([], { month: '2-digit', day: '2-digit' })}
                        </span>
                        <div className={cn(
                          "mt-2 px-2 py-0.5 rounded-full text-[9px] font-black tracking-tight",
                          calculateDayCost(i) > budgetLimit ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          预计 ¥{calculateDayCost(i).toFixed(1)}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-2 border-slate-100">
                  <td className="p-6 bg-slate-50 border-r-2 border-slate-200 font-black text-slate-900 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Zap className="w-6 h-6 text-orange-500" />
                       <span className="text-xs">早餐</span>
                    </div>
                  </td>
                  {draftMenu.days.map((day, i) => (
                    <td 
                      key={`b-${i}`} 
                      className="p-4 border-r-2 border-slate-100 last:border-r-0 align-top"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, i, 'breakfast')}
                    >
                      <div className="flex flex-col gap-2 min-h-[100px]">
                        {day.breakfast.recipeIds.map((rid, rIndex) => {
                          const r = recipes.find(rec => rec.id === rid);
                          return r ? (
                            <div 
                              key={rid + '-' + rIndex} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, i, 'breakfast', rIndex, rid)}
                              className={cn(
                                "p-2 rounded-xl border text-[11px] font-bold flex flex-col gap-1 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group/pill relative",
                                CATEGORY_MAP[(Array.isArray(r.category) ? r.category[0] : r.category)]?.pillColor || "bg-slate-50 border-slate-200 text-slate-900"
                              )}
                            >
                              <span>{r.name}</span>
                              <span className="text-[9px] opacity-60">¥{r.estimatedCost.toFixed(1)}</span>
                              <div className="absolute top-0 right-0 -mt-2 -mr-2 hidden group-hover/pill:flex gap-1 bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden z-10">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setRecipeSelectorTarget({dayIndex: i, meal: 'breakfast', replaceIndex: rIndex}); }}
                                  className="p-1 hover:bg-slate-100 text-blue-600 transition-colors" title="换菜"
                                ><RefreshCw className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); startEditRecipe(r); }}
                                  className="p-1 hover:bg-slate-100 text-indigo-600 transition-colors" title="修改菜谱项"
                                ><Edit2 className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveFromMenu(i, 'breakfast', rIndex); }}
                                  className="p-1 hover:bg-slate-100 text-red-600 transition-colors" title="删除"
                                ><X className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ) : null;
                        })}
                        <button
                          type="button"
                          onClick={() => setRecipeSelectorTarget({ dayIndex: i, meal: 'breakfast' })}
                          className="w-full mt-auto p-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all text-xs font-black flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
                        >
                          <Plus className="w-3 h-3" /> 添加
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr className="border-b-2 border-slate-100">
                  <td className="p-6 bg-slate-50 border-r-2 border-slate-200 font-black text-slate-900 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Zap className="w-6 h-6 text-blue-500" />
                       <span className="text-xs">午餐</span>
                    </div>
                  </td>
                  {draftMenu.days.map((day, i) => (
                    <td 
                      key={`l-${i}`} 
                      className="p-4 border-r-2 border-slate-100 last:border-r-0 align-top"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, i, 'lunch')}
                    >
                      <div className="flex flex-col gap-2 min-h-[120px]">
                        {day.lunch.recipeIds.map((rid, rIndex) => {
                          const r = recipes.find(rec => rec.id === rid);
                          return r ? (
                            <div 
                              key={rid + '-' + rIndex} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, i, 'lunch', rIndex, rid)}
                              className={cn(
                                "p-2 rounded-xl border text-[11px] font-bold flex flex-col gap-1 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group/pill relative",
                                CATEGORY_MAP[(Array.isArray(r.category) ? r.category[0] : r.category)]?.pillColor || "bg-slate-50 border-slate-200 text-slate-900"
                              )}
                            >
                              <span>{r.name}</span>
                              <span className="text-[9px] opacity-60">¥{r.estimatedCost.toFixed(1)}</span>
                              <div className="absolute top-0 right-0 -mt-2 -mr-2 hidden group-hover/pill:flex gap-1 bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden z-10">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setRecipeSelectorTarget({dayIndex: i, meal: 'lunch', replaceIndex: rIndex}); }}
                                  className="p-1 hover:bg-slate-100 text-blue-600 transition-colors" title="换菜"
                                ><RefreshCw className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); startEditRecipe(r); }}
                                  className="p-1 hover:bg-slate-100 text-indigo-600 transition-colors" title="修改菜谱项"
                                ><Edit2 className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveFromMenu(i, 'lunch', rIndex); }}
                                  className="p-1 hover:bg-slate-100 text-red-600 transition-colors" title="删除"
                                ><X className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ) : null;
                        })}
                        <button
                          type="button"
                          onClick={() => setRecipeSelectorTarget({ dayIndex: i, meal: 'lunch' })}
                          className="w-full mt-auto p-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all text-xs font-black flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
                        >
                          <Plus className="w-3 h-3" /> 添加
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-6 bg-slate-50 border-r-2 border-slate-200 font-black text-slate-900 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Zap className="w-6 h-6 text-indigo-500" />
                       <span className="text-xs">晚餐</span>
                    </div>
                  </td>
                  {draftMenu.days.map((day, i) => (
                    <td 
                      key={`d-${i}`} 
                      className="p-4 border-r-2 border-slate-100 last:border-r-0 align-top"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, i, 'dinner')}
                    >
                      <div className="flex flex-col gap-2 min-h-[100px]">
                         {day.dinner.recipeIds.map((rid, rIndex) => {
                          const r = recipes.find(rec => rec.id === rid);
                          return r ? (
                            <div 
                              key={rid + '-' + rIndex} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, i, 'dinner', rIndex, rid)}
                              className={cn(
                                "p-2 rounded-xl border text-[11px] font-bold flex flex-col gap-1 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group/pill relative",
                                CATEGORY_MAP[(Array.isArray(r.category) ? r.category[0] : r.category)]?.pillColor || "bg-slate-50 border-slate-200 text-slate-900"
                              )}
                            >
                              <span>{r.name}</span>
                              <span className="text-[9px] opacity-60">¥{r.estimatedCost.toFixed(1)}</span>
                              <div className="absolute top-0 right-0 -mt-2 -mr-2 hidden group-hover/pill:flex gap-1 bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden z-10">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setRecipeSelectorTarget({dayIndex: i, meal: 'dinner', replaceIndex: rIndex}); }}
                                  className="p-1 hover:bg-slate-100 text-blue-600 transition-colors" title="换菜"
                                ><RefreshCw className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); startEditRecipe(r); }}
                                  className="p-1 hover:bg-slate-100 text-indigo-600 transition-colors" title="修改菜谱项"
                                ><Edit2 className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveFromMenu(i, 'dinner', rIndex); }}
                                  className="p-1 hover:bg-slate-100 text-red-600 transition-colors" title="删除"
                                ><X className="w-3 h-3" /></button>
                              </div>
                            </div>
                          ) : null;
                        })}
                        <button
                          type="button"
                          onClick={() => setRecipeSelectorTarget({ dayIndex: i, meal: 'dinner' })}
                          className="w-full mt-auto p-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all text-xs font-black flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
                        >
                          <Plus className="w-3 h-3" /> 添加
                        </button>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddingRecipe && editingRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsAddingRecipe(false)}></div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] border-2 border-slate-200 shadow-2xl relative z-10 p-10 overflow-y-auto max-h-[90vh] custom-scrollbar"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900">
                {recipes.find(r => r.id === editingRecipe.id) ? '编辑菜谱' : '新增菜谱'}
              </h3>
              <button onClick={() => setIsAddingRecipe(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleCreateRecipe} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">菜品名称</label>
                <input 
                  required
                  type="text" 
                  value={editingRecipe.name}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, name: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-4 font-black transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none" 
                  placeholder="请输入菜名，如：酸辣土豆丝"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">实施后食客反馈分数 (口味满意度)</label>
                  <div className="flex items-center gap-2 w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setEditingRecipe({ ...editingRecipe, rating: star })}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star 
                          className={cn("w-6 h-6", (editingRecipe.rating || 0) >= star ? "text-amber-400 fill-amber-400" : "text-slate-200")} 
                        />
                      </button>
                    ))}
                    <span className="text-sm font-black text-slate-500 ml-auto">食客反馈 {editingRecipe.rating || 0} / 5</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold px-1 mt-1 leading-relaxed">
                    注：打星时间应为菜谱实施后，纯粹基于客人的口味反馈。AI 在为您生成最终周谱时，会自动将此反馈得分与上方「单项成本维度」综合评判。
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">菜品类别 (可多选)</label>
                  <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl">
                    {(Object.keys(CATEGORY_MAP) as RecipeCategory[]).map(cat => {
                      const currentCats = Array.isArray(editingRecipe.category) ? editingRecipe.category : [editingRecipe.category];
                      const isSelected = currentCats.includes(cat);
                      return (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-sm p-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            className="w-4 h-4 accent-indigo-600 rounded border-2 border-slate-300"
                            onChange={(e) => {
                              let nextCats = [...currentCats];
                              if (e.target.checked && !isSelected) {
                                nextCats.push(cat);
                              } else if (!e.target.checked && isSelected) {
                                nextCats = nextCats.filter(c => c !== cat);
                              }
                              if (nextCats.length === 0) nextCats = ['other'];
                              setEditingRecipe({ ...editingRecipe, category: nextCats });
                            }}
                          />
                          <span className={cn("px-2 py-1 rounded text-[10px]", CATEGORY_MAP[cat].color, "text-white")}>
                            {CATEGORY_MAP[cat].label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">预估单人成本 (元)</label>
                  <input 
                    required
                    type="number"
                    step="0.1" 
                    value={editingRecipe.estimatedCost}
                    onChange={(e) => setEditingRecipe({ ...editingRecipe, estimatedCost: Number(e.target.value) })}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-4 font-black outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">营养标签</label>
                <div className="flex flex-wrap gap-2">
                  {NUTRITION_OPTIONS.map(tag => (
                    <button 
                      type="button"
                      key={tag}
                      onClick={() => {
                        const tags = editingRecipe.nutritionTags.includes(tag)
                          ? editingRecipe.nutritionTags.filter(t => t !== tag)
                          : [...editingRecipe.nutritionTags, tag];
                        setEditingRecipe({ ...editingRecipe, nutritionTags: tags });
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-black border-2 transition-all",
                        editingRecipe.nutritionTags.includes(tag) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-400 hover:border-slate-300"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">指定绑定餐段 (选填，AI会遵守安排)</label>
                <div className="flex gap-4 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl">
                  {[{ id: 'breakfast', label: '早餐' }, { id: 'lunch', label: '午餐' }, { id: 'dinner', label: '晚餐' }].map((mType) => {
                    const isSelected = editingRecipe.mealTime?.includes(mType.id as any) || false;
                    return (
                      <label key={mType.id} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 text-sm">
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-indigo-600 rounded border-2 border-slate-300"
                          checked={isSelected}
                          onChange={(e) => {
                            let updated = [...(editingRecipe.mealTime || [])];
                            if (e.target.checked && !isSelected) updated.push(mType.id as any);
                            else if (!e.target.checked && isSelected) updated = updated.filter(t => t !== mType.id);
                            setEditingRecipe({ ...editingRecipe, mealTime: updated });
                          }}
                        />
                        {mType.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">备注说明</label>
                <textarea 
                  value={editingRecipe.description}
                  onChange={(e) => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-4 font-bold outline-none min-h-[100px]"
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
              >
                <Save className="w-6 h-6" />
                保存菜谱
              </button>
            </form>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {recipeSelectorTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setRecipeSelectorTarget(null)}></div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] border-2 border-slate-200 shadow-2xl relative z-10 p-8 flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {recipeSelectorTarget.replaceIndex !== undefined ? '替换菜品' : '添加菜品'}
                  </h3>
                  <p className="text-sm font-bold text-slate-400 mt-1">
                    星期{['一', '二', '三', '四', '五', '六', '日'][recipeSelectorTarget.dayIndex]} 
                    {recipeSelectorTarget.meal === 'breakfast' ? ' 早餐' : recipeSelectorTarget.meal === 'lunch' ? ' 午餐' : ' 晚餐'}
                  </p>
                </div>
                <button onClick={() => setRecipeSelectorTarget(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-6 h-6" /></button>
              </div>

              <div className="mb-6 relative">
                <input 
                  type="text" 
                  value={recipeSearchTerm}
                  onChange={(e) => setRecipeSearchTerm(e.target.value)}
                  placeholder="搜索菜名快捷挑选..."
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-black transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none"
                />
                <Utensils className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {recipes
                  .filter(r => !recipeSearchTerm || r.name.includes(recipeSearchTerm))
                  .map(r => (
                    <button 
                      key={r.id}
                      onClick={() => onSelectRecipeForMenu(r.id)}
                      className="w-full bg-white border-2 border-slate-100 hover:border-indigo-600 p-4 rounded-2xl flex items-center justify-between group transition-all text-left"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{r.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-md", CATEGORY_MAP[Array.isArray(r.category) ? r.category[0] : r.category]?.color || "bg-slate-500", "text-white")}>
                            {CATEGORY_MAP[Array.isArray(r.category) ? r.category[0] : r.category]?.label || r.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {r.rating || 0}/5
                          </span>
                        </div>
                      </div>
                      <span className="font-black text-indigo-600">¥{r.estimatedCost.toFixed(1)}</span>
                    </button>
                  ))
                }
                {recipes.filter(r => !recipeSearchTerm || r.name.includes(recipeSearchTerm)).length === 0 && (
                  <div className="py-12 text-center text-slate-400 font-bold">没有符合条件的菜品库结果。</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
