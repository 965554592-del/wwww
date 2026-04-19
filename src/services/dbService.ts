import { Entry, Vendor, MonthlyReport, Recipe, WeeklyMenu } from '../types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

export const dbService = {
  // Entries
  async getAllEntries(): Promise<Entry[]> {
    return request<Entry[]>('/entries');
  },
  async saveEntry(entry: Entry): Promise<void> {
    await request('/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },
  async deleteEntry(id: string): Promise<void> {
    await request(`/entries/${id}`, { method: 'DELETE' });
  },
  async bulkSaveEntries(entries: Entry[]): Promise<void> {
    await request('/entries/bulk', {
      method: 'POST',
      body: JSON.stringify(entries),
    });
  },

  // Vendors
  async getAllVendors(): Promise<Vendor[]> {
    return request<Vendor[]>('/vendors');
  },
  async saveVendor(vendor: Vendor): Promise<void> {
    await request('/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
  },
  async deleteVendor(id: string): Promise<void> {
    await request(`/vendors/${id}`, { method: 'DELETE' });
  },

  // Reports
  async getAllReports(): Promise<MonthlyReport[]> {
    return request<MonthlyReport[]>('/reports');
  },
  async saveReport(report: MonthlyReport): Promise<void> {
    await request('/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  },

  // Reference Prices
  async getAllReferencePrices(): Promise<Record<string, number>> {
    return request<Record<string, number>>('/reference-prices');
  },
  async saveReferencePrice(name: string, price: number): Promise<void> {
    await request('/reference-prices', {
      method: 'POST',
      body: JSON.stringify({ name, price }),
    });
  },
  async deleteReferencePrice(name: string): Promise<void> {
    await request(`/reference-prices/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },
  async bulkSaveReferencePrices(prices: Record<string, number>): Promise<void> {
    await request('/reference-prices/bulk', {
      method: 'POST',
      body: JSON.stringify(prices),
    });
  },

  // Recipes
  async getAllRecipes(): Promise<Recipe[]> {
    return request<Recipe[]>('/recipes');
  },
  async saveRecipe(recipe: Recipe): Promise<void> {
    await request('/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe),
    });
  },
  async deleteRecipe(id: string): Promise<void> {
    await request(`/recipes/${id}`, { method: 'DELETE' });
  },

  // Weekly Menus
  async getAllWeeklyMenus(): Promise<WeeklyMenu[]> {
    return request<WeeklyMenu[]>('/weekly-menus');
  },
  async saveWeeklyMenu(menu: WeeklyMenu): Promise<void> {
    await request('/weekly-menus', {
      method: 'POST',
      body: JSON.stringify(menu),
    });
  },

  // Settings
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const result = await request<{ value: any }>(`/settings/${key}`);
    return result.value !== null ? result.value : defaultValue;
  },
  async saveSetting(key: string, value: any): Promise<void> {
    await request(`/settings/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    });
  },

  async clearAll(): Promise<void> {
    await request('/clear-all', { method: 'POST' });
  },

  // Storage Path
  async getStoragePath(): Promise<string> {
    const result = await request<{ path: string }>('/storage/path');
    return result.path;
  },
  async setStoragePath(newPath: string): Promise<void> {
    await request('/storage/path', {
      method: 'POST',
      body: JSON.stringify({ path: newPath }),
    });
  }
};
