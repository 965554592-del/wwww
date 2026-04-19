import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import cors from 'cors';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(process.cwd(), 'db_config.json');

function getDbPath() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return config.dbPath || 'cafeteria_v3.db';
    } catch (e) {
      return 'cafeteria_v3.db';
    }
  }
  return 'cafeteria_v3.db';
}

function saveDbPath(newPath: string) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ dbPath: newPath }, null, 2));
}

import OpenAI from 'openai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // AI Configuration
  const domesticAi = new OpenAI({
    apiKey: process.env.DOMESTIC_AI_API_KEY || 'sk-8mlVkYQHkhcFg4N4gS3DAf0NpSCN9yiWLEwvUIWpc9fBEhnK',
    baseURL: process.env.DOMESTIC_AI_BASE_URL || 'https://www.dmxapi.cn/v1'
  });

  let currentDbPath = getDbPath();
  let db: any;

  function initDb(p: string) {
    if (db) db.close();
    
    // Ensure directory exists
    const dir = path.dirname(p);
    if (dir !== '.' && !fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        console.error('Failed to create directory:', dir);
      }
    }

    db = new Database(p, { verbose: console.log });
    db.pragma('journal_mode = WAL');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        date TEXT,
        productName TEXT,
        unit TEXT,
        quantity REAL,
        price REAL,
        total REAL,
        vendorId TEXT,
        notes TEXT
      );
      CREATE TABLE IF NOT EXISTS vendors (id TEXT PRIMARY KEY, name TEXT, isPreferred INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS reports (periodName TEXT PRIMARY KEY, startDate TEXT, endDate TEXT, summary TEXT, details TEXT);
      CREATE TABLE IF NOT EXISTS reference_prices (name TEXT PRIMARY KEY, price REAL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS recipes (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        estimatedCost REAL,
        rating REAL DEFAULT 0,
        nutritionTags TEXT,
        mealTime TEXT,
        ingredients TEXT,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS weekly_menus (
        weekId TEXT PRIMARY KEY,
        days TEXT,
        budgetPerDay REAL
      );
    `);
    currentDbPath = p;
    
    // Add rating column for existing databases without throwing errors if it exists
    try {
      db.exec('ALTER TABLE recipes ADD COLUMN rating REAL DEFAULT 0');
    } catch(e) {
      // Column might already exist, ignore error
    }
    
    // Add mealTime column for existing databases
    try {
      db.exec('ALTER TABLE recipes ADD COLUMN mealTime TEXT');
    } catch(e) {
      // Column might already exist, ignore error
    }

    console.log(`SQLite database connected at: ${p}`);
  }

  initDb(currentDbPath);

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // AI Proxy Logic
  app.post('/api/ai/domestic', async (req, res) => {
    const { messages, model, response_format } = req.body;
    
    // We remove the strict empty-string check since we embedded a highly permissive fallback for the specific user request
    const currentApiKey = process.env.DOMESTIC_AI_API_KEY || 'sk-8mlVkYQHkhcFg4N4gS3DAf0NpSCN9yiWLEwvUIWpc9fBEhnK';
    if (!currentApiKey || currentApiKey === 'not-set') {
      return res.status(503).json({ error: 'Domestic AI is not configured on the server.' });
    }

    try {
      const completion = await domesticAi.chat.completions.create({
        messages,
        model: model || process.env.DOMESTIC_AI_MODEL || 'KAT-Coder-ProV2-free',
        response_format: response_format || undefined
      });
      res.json(completion);
    } catch (error: any) {
      console.error('Domestic AI Proxy Error:', error);
      res.status(500).json({ error: error.message || 'AI Proxy Error' });
    }
  });

  // Storage Path API
  app.get('/api/storage/path', (req, res) => {
    res.json({ path: currentDbPath });
  });

  app.post('/api/storage/path', (req, res) => {
    const { path: newPath } = req.body;
    if (!newPath) return res.status(400).json({ error: 'Path is required' });
    
    try {
      saveDbPath(newPath);
      // We don't hot-swap in this simple version to avoid locking issues, 
      // but we inform the user to restart or we could try to initDb.
      // For this app, let's try to initDb immediately.
      initDb(newPath);
      res.json({ success: true, path: newPath });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Entries
  app.get('/api/entries', (req, res) => {
    const rows = db.prepare('SELECT * FROM entries').all();
    res.json(rows);
  });

  app.post('/api/entries', (req, res) => {
    const entry = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO entries (id, date, productName, unit, quantity, price, total, vendorId, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(entry.id, entry.date, entry.productName, entry.unit, entry.quantity, entry.price, entry.total, entry.vendorId, entry.notes);
    res.json({ success: true });
  });

  app.delete('/api/entries/:id', (req, res) => {
    db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/entries/bulk', (req, res) => {
    const entries = req.body;
    const insert = db.prepare(`
      INSERT OR REPLACE INTO entries (id, date, productName, unit, quantity, price, total, vendorId, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const bulkInsert = db.transaction((data) => {
      for (const entry of data) {
        insert.run(entry.id, entry.date, entry.productName, entry.unit, entry.quantity, entry.price, entry.total, entry.vendorId, entry.notes);
      }
    });
    bulkInsert(entries);
    res.json({ success: true });
  });

  // Vendors
  app.get('/api/vendors', (req, res) => {
    const rows = db.prepare('SELECT * FROM vendors').all().map((v: any) => ({ ...v, isPreferred: !!v.isPreferred }));
    res.json(rows);
  });

  app.post('/api/vendors', (req, res) => {
    const v = req.body;
    db.prepare('INSERT OR REPLACE INTO vendors (id, name, isPreferred) VALUES (?, ?, ?)')
      .run(v.id, v.name, v.isPreferred ? 1 : 0);
    res.json({ success: true });
  });

  app.delete('/api/vendors/:id', (req, res) => {
    db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Reference Prices
  app.get('/api/reference-prices', (req, res) => {
    const rows = db.prepare('SELECT * FROM reference_prices').all();
    const map: Record<string, number> = {};
    rows.forEach((row: any) => { map[row.name] = row.price; });
    res.json(map);
  });

  app.post('/api/reference-prices', (req, res) => {
    const { name, price } = req.body;
    db.prepare('INSERT OR REPLACE INTO reference_prices (name, price) VALUES (?, ?)').run(name, price);
    res.json({ success: true });
  });

  app.delete('/api/reference-prices/:name', (req, res) => {
    db.prepare('DELETE FROM reference_prices WHERE name = ?').run(req.params.name);
    res.json({ success: true });
  });

  app.post('/api/reference-prices/bulk', (req, res) => {
    const prices = req.body;
    const insert = db.prepare('INSERT OR REPLACE INTO reference_prices (name, price) VALUES (?, ?)');
    const bulkInsert = db.transaction((data) => {
      for (const [name, price] of Object.entries(data)) {
        insert.run(name, price as number);
      }
    });
    bulkInsert(prices);
    res.json({ success: true });
  });

  // Reports
  app.get('/api/reports', (req, res) => {
    const rows = db.prepare('SELECT * FROM reports').all().map((r: any) => ({
      ...r,
      summary: JSON.parse(r.summary),
      details: JSON.parse(r.details)
    }));
    res.json(rows);
  });

  app.post('/api/reports', (req, res) => {
    const r = req.body;
    db.prepare('INSERT OR REPLACE INTO reports (periodName, startDate, endDate, summary, details) VALUES (?, ?, ?, ?, ?)')
      .run(r.periodName, r.startDate, r.endDate, JSON.stringify(r.summary), JSON.stringify(r.details));
    res.json({ success: true });
  });

  // Settings
  app.get('/api/settings/:key', (req, res) => {
    const row: any = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
    res.json({ value: row ? JSON.parse(row.value) : null });
  });

  app.post('/api/settings/:key', (req, res) => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(req.params.key, JSON.stringify(req.body.value));
    res.json({ success: true });
  });

  // Recipes
  app.get('/api/recipes', (req, res) => {
    const rows = db.prepare('SELECT * FROM recipes').all().map((row: any) => {
      let category = row.category;
      try {
        category = JSON.parse(category);
      } catch (e) {
        // Keep as string if not JSON
      }
      return {
        ...row,
        category,
        nutritionTags: JSON.parse(row.nutritionTags),
        mealTime: row.mealTime ? JSON.parse(row.mealTime) : [],
        ingredients: JSON.parse(row.ingredients)
      };
    });
    res.json(rows);
  });

  app.post('/api/recipes', (req, res) => {
    const r = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO recipes (id, name, category, estimatedCost, rating, nutritionTags, mealTime, ingredients, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      r.id, 
      r.name, 
      JSON.stringify(r.category), 
      r.estimatedCost, 
      r.rating || 0, 
      JSON.stringify(r.nutritionTags), 
      JSON.stringify(r.mealTime || []),
      JSON.stringify(r.ingredients), 
      r.description
    );
    res.json({ success: true });
  });

  app.delete('/api/recipes/:id', (req, res) => {
    db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Weekly Menus
  app.get('/api/weekly-menus', (req, res) => {
    const rows = db.prepare('SELECT * FROM weekly_menus').all().map((row: any) => ({
      ...row,
      days: JSON.parse(row.days)
    }));
    res.json(rows);
  });

  app.post('/api/weekly-menus', (req, res) => {
    const m = req.body;
    db.prepare('INSERT OR REPLACE INTO weekly_menus (weekId, days, budgetPerDay) VALUES (?, ?, ?)')
      .run(m.weekId, JSON.stringify(m.days), m.budgetPerDay);
    res.json({ success: true });
  });

  app.post('/api/clear-all', (req, res) => {
    db.exec(`
      DELETE FROM entries;
      DELETE FROM vendors;
      DELETE FROM reports;
      DELETE FROM reference_prices;
      DELETE FROM settings;
      DELETE FROM recipes;
      DELETE FROM weekly_menus;
    `);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
        host: '0.0.0.0',
        cors: true
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Serve and transform index.html for the root route and SPA fallback
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`SQLite database initialized: cafeteria_v3.db`);
  });
}

startServer();
