export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD
  productName: string;
  unit: string;
  quantity: number;
  price: number;
  subtotal: number;
  remarks: string;
  periodName: string;
  refPriceAtEntry?: number; // 基准价快照
  vendorId?: string; // 供应商ID
}

export interface Vendor {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  isPreferred?: boolean;
}

export interface PriceRecord {
  id: string;
  entryId: string;
  periodName: string;
  date: string;
  productName: string;
  price: number;
  prevPrice: number | null;
  difference: number | null;
}

export interface MonthlyReport {
  id: string;
  periodName: string; // e.g., "2025年11月"
  startDate: string;
  endDate: string;
  breakfastCount: number;
  lunchCount: number;
  dinnerCount: number;
  breakfastSubsidy: number;
  lunchSubsidy: number;
  dinnerSubsidy: number;
  guestMealsCount: number;
  guestMealsRate: number;
  satisfactionRate: number; // 0-100
  totalStaffCount: number;
  unhappyCount: number;
  cadreCount?: number;
  staffCount?: number;
  otherBreakfastCount?: number;
  otherLunchCount?: number;
  otherDinnerCount?: number;
  otherBreakfastAmount?: number;
  otherLunchAmount?: number;
  otherDinnerAmount?: number;
  annualContractTotal: number;
  lastUpdated: string;
}

export type RecipeCategory = 'staple' | 'meat' | 'vegetable' | 'soup' | 'coarse_grain' | 'breakfast' | 'lunch' | 'fruit' | 'other';

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory | RecipeCategory[];
  estimatedCost: number; // 预估单人成本
  rating?: number; // 菜品打分 0-5
  nutritionTags: string[]; // 营养标签: 蛋白质, 纤维, 维生素, 碳水等
  mealTime?: ('breakfast' | 'lunch' | 'dinner')[]; // 适用的就餐时段：早、中、晚
  ingredients: { name: string; amount: string }[];
  description?: string;
}

export interface MenuItem {
  recipeIds: string[]; // 一个时段可能有多个菜 (如一荤一素)
}

export interface DayMenu {
  breakfast: MenuItem;
  lunch: MenuItem;
  dinner: MenuItem;
}

export interface WeeklyMenu {
  weekId: string; // e.g., "2026-W08" or "2026-02-24" (starting date)
  days: DayMenu[]; // 长度为 7 的数组
  budgetPerDay: number;
}
