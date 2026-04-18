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
