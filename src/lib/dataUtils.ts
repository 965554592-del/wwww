import { Entry, PriceRecord } from '../types';

export function computePriceRecords(entries: Entry[]): PriceRecord[] {
  // Sort entries by date ascending
  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const records: PriceRecord[] = [];
  const lastPriceMap = new Map<string, number>(); 

  for (const entry of sorted) {
     const key = entry.productName; // Changed: Track globally by product name
     const prevPrice = lastPriceMap.get(key) ?? null;
     
     const diff = prevPrice !== null ? entry.price - prevPrice : null;
     
     records.push({
        id: `pr_${entry.id}`,
        entryId: entry.id,
        periodName: entry.periodName,
        date: entry.date,
        productName: entry.productName,
        price: entry.price,
        prevPrice,
        difference: diff
     });
     
     lastPriceMap.set(key, entry.price);
  }
  
  // Return records sorted by date descending for view
  return records.reverse();
}

export interface InventoryRow {
  id: string;
  periodName: string;
  productName: string;
  unit: string;
  price: number;
  prevBalanceQty: number;
  prevBalanceAmt: number;
  inQty: number;
  inAmt: number;
  outQty: number;
  outAmt: number;
  balanceQty: number;
  balanceAmt: number;
}

export function computeInventory(entries: Entry[], selectedPeriod: string): InventoryRow[] {
   const rows = new Map<string, InventoryRow>();
   
   for (const entry of entries) {
      if (entry.periodName !== selectedPeriod) continue;
      
      const key = `${entry.productName}_${entry.unit}_${(entry.price || 0).toFixed(1)}`;
      if (!rows.has(key)) {
         rows.set(key, {
            id: key,
            periodName: entry.periodName,
            productName: entry.productName,
            unit: entry.unit,
            price: entry.price,
            prevBalanceQty: 0,
            prevBalanceAmt: 0,
            inQty: 0,
            inAmt: 0,
            outQty: 0,
            outAmt: 0,
            balanceQty: 0,
            balanceAmt: 0
         });
      }
      const r = rows.get(key)!;
      r.inQty += entry.quantity;
      r.inAmt += (entry.quantity * entry.price);
      r.outQty = r.inQty; 
      r.outAmt = r.inAmt; 
      r.balanceQty = r.prevBalanceQty + r.inQty - r.outQty;
      r.balanceAmt = r.prevBalanceAmt + r.inAmt - r.outAmt;
   }
   
   return Array.from(rows.values()).sort((a, b) => a.productName.localeCompare(b.productName));
}

export function getAvailablePeriods(entries: Entry[]): string[] {
  const periods = new Set<string>();
  for (const entry of entries) {
    periods.add(entry.periodName);
  }
  const arr = Array.from(periods);
  // Sort descending (simplistic text sort works for YYYY年M月 if month is padded, but wait, "2025年2月" vs "2025年12月").
  arr.sort((a, b) => {
    const [yA, mA] = a.replace('月', '').split('年').map(Number);
    const [yB, mB] = b.replace('月', '').split('年').map(Number);
    if (yA !== yB) return yB - yA;
    return mB - mA;
  });
  return arr;
}
