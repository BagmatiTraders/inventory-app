import * as SQLite from 'expo-sqlite';

/**
 * DATABASE SCHEMA
 * 
 * sync_queue: stores actions to be pushed to the server
 * products: local cache of inventory
 * orders: local cache of marketplace orders
 * marketplace_orders: local cache of marketplace orders
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const initDatabase = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('inventory.db');
  }
  const db = await dbPromise;

  // Create sync_queue table
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      price REAL,
      stock INTEGER,
      image_url TEXT,
      product_type TEXT,
      product_id TEXT,
      updated_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      party_name TEXT,
      amount REAL,
      type TEXT,
      timestamp DATETIME,
      sync_status TEXT DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      supplier_name TEXT NOT NULL,
      contact_details TEXT,
      remarks TEXT,
      is_deleted INTEGER DEFAULT 0,
      updated_at DATETIME
    );
    CREATE TABLE IF NOT EXISTS purchase_plans (
      id TEXT PRIMARY KEY,
      plan_date TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      remarks TEXT,
      status TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME,
      snapshot_latest_price REAL,
      snapshot_latest_supplier TEXT,
      snapshot_low_price REAL,
      snapshot_low_supplier TEXT,
      cached_product_name TEXT,
      cached_product_image TEXT,
      sync_status TEXT DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      purchase_date TEXT NOT NULL,
      product_id TEXT,
      supplier_id TEXT,
      quantity INTEGER NOT NULL,
      unit_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_type TEXT,
      remarks TEXT,
      purchase_type TEXT,
      purchase_name TEXT,
      sync_status TEXT DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS supplier_transactions (
      id TEXT PRIMARY KEY,
      transaction_date TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      transaction_mode TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      cheque_date TEXT,
      remarks TEXT,
      sync_status TEXT DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS opening_stocks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      remarks TEXT,
      created_at DATETIME,
      updated_at DATETIME,
      sync_status TEXT DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS manual_adjustments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS mobile_captures (
      id TEXT PRIMARY KEY,
      image_path TEXT,
      image_url TEXT NOT NULL,
      price REAL,
      remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS store_sales (
      id TEXT PRIMARY KEY,
      sale_date TEXT NOT NULL,
      customer_name TEXT DEFAULT 'User',
      payment_type TEXT DEFAULT 'Cash',
      remarks TEXT,
      total_amount REAL,
      created_at DATETIME,
      updated_at DATETIME,
      sync_status TEXT DEFAULT 'synced'
    );
    CREATE TABLE IF NOT EXISTS store_sales_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT,
      product_code TEXT,
      qty REAL,
      amount REAL,
      FOREIGN KEY(sale_id) REFERENCES store_sales(id)
    );
    `);

  // --- Migrations / Schema Updates ---
  // Since CREATE TABLE IF NOT EXISTS doesn't add columns or change constraints, we do it manually
  try {
    // Check if purchases table has NOT NULL on product_id
    const tableInfo = await db.getAllAsync<any>("PRAGMA table_info(purchases)");
    const productIdInfo = tableInfo.find(info => info.name === 'product_id');
    if (productIdInfo && productIdInfo.notnull === 1) {
      console.log('Migrating purchases table to remove NOT NULL constraints...');
      // SQLite doesn't support ALTER TABLE DROP NOT NULL, so we recreate
      await db.execAsync(`
        CREATE TABLE purchases_new (
          id TEXT PRIMARY KEY,
          purchase_date TEXT NOT NULL,
          product_id TEXT,
          supplier_id TEXT,
          quantity INTEGER NOT NULL,
          unit_amount REAL NOT NULL,
          total_amount REAL NOT NULL,
          payment_type TEXT,
          remarks TEXT,
          purchase_type TEXT,
          purchase_name TEXT,
          sync_status TEXT DEFAULT 'synced'
        );
        INSERT INTO purchases_new SELECT * FROM purchases;
        DROP TABLE purchases;
        ALTER TABLE purchases_new RENAME TO purchases;
      `);
      console.log('Successfully migrated purchases table.');
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
  try {
    await db.execAsync('ALTER TABLE products ADD COLUMN image_url TEXT;');
    console.log('Added image_url column to products table');
  } catch (e) {
    // Column probably already exists, ignore
  }

  try {
    await db.execAsync('ALTER TABLE products ADD COLUMN product_type TEXT;');
    console.log('Added product_type column to products table');
  } catch (e) { }

  try {
    await db.execAsync('ALTER TABLE purchase_plans ADD COLUMN snapshot_low_price REAL;');
    await db.execAsync('ALTER TABLE purchase_plans ADD COLUMN snapshot_low_supplier TEXT;');
  } catch (e) { }

  try {
    await db.execAsync('ALTER TABLE purchase_plans ADD COLUMN cached_product_name TEXT;');
    await db.execAsync('ALTER TABLE purchase_plans ADD COLUMN cached_product_image TEXT;');
  } catch (e) { }

  try {
    await db.execAsync('ALTER TABLE products ADD COLUMN product_id TEXT;');
    console.log('Added product_id column to products table');
  } catch (e) {
    console.log('Migration note (product_id):', e);
  }

  // Seed data if empty
  const productCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM products');
  if (productCount && productCount.count === 0) {
    await seedDatabase(db);
  }

  return db;
};

const seedDatabase = async (db: SQLite.SQLiteDatabase) => {
  console.log('Seeding initial data...');
  const now = new Date().toISOString();

  // Seed Products
  await db.runAsync(`INSERT INTO products (id, name, sku, price, stock, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['1', 'White Cement', 'WC-001', 850, 50, now]);
  await db.runAsync(`INSERT INTO products (id, name, sku, price, stock, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ['2', 'Paints (Red)', 'P-RED', 1200, 20, now]);

  // Seed Transactions
  await db.runAsync(`INSERT INTO transactions (id, party_name, amount, type, timestamp, sync_status) VALUES (?, ?, ?, ?, ?, ?)`,
    ['t1', 'Ram Kumar', 12500, 'IN', now, 'synced']);
  await db.runAsync(`INSERT INTO transactions (id, party_name, amount, type, timestamp, sync_status) VALUES (?, ?, ?, ?, ?, ?)`,
    ['t2', 'Shyam Traders', 5000, 'OUT', now, 'synced']);
};

export const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('inventory.db');
  }
  return await dbPromise;
};
