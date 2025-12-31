-- 1. Drop old constraint FIRST (Crucial step to allow updates)
ALTER TABLE daraz_orders DROP CONSTRAINT IF EXISTS daraz_orders_order_status_check;

-- 2. FIX EXISTING DATA (Now safe to run)
UPDATE daraz_orders SET order_status = 'Returning to Seller' WHERE order_status IN ('Delivery Failed', 'Failed Delivered', 'failed_delivery', 'delivery_failed', 'Returning To Seller', 'shipped_back');
UPDATE daraz_orders SET order_status = 'Returned Delivered' WHERE order_status IN ('shipped_back_success', 'returned_delivered');
UPDATE daraz_orders SET order_status = 'Customer Return Delivered' WHERE order_status IN ('Returned', 'returned');
UPDATE daraz_orders SET order_status = 'Customer Return' WHERE order_status IN ('customer_return');
UPDATE daraz_orders SET order_status = 'Cancel' WHERE order_status IN ('Cancelled', 'canceled', 'Canceled');

-- 3. Add new constraint with STRICT statuses
ALTER TABLE daraz_orders ADD CONSTRAINT daraz_orders_order_status_check 
CHECK (order_status IN (
  'Unpaid',
  'Pending', 
  'Packed', 
  'Ready to Ship', 
  'Shipped', 
  'Delivered', 
  'Returning to Seller', 
  'Returned Delivered', 
  'Customer Return', 
  'Customer Return Delivered',
  'Cancel'
));

-- 4. Add missing timestamp columns
ALTER TABLE daraz_orders ADD COLUMN IF NOT EXISTS customer_return_delivered_at TIMESTAMPTZ;
ALTER TABLE daraz_orders ADD COLUMN IF NOT EXISTS returned_delivered_at TIMESTAMPTZ;
ALTER TABLE daraz_orders ADD COLUMN IF NOT EXISTS returning_to_seller_at TIMESTAMPTZ;
ALTER TABLE daraz_orders ADD COLUMN IF NOT EXISTS customer_return_at TIMESTAMPTZ;

-- 5. Add purchase_type to purchases table
-- 5. Add purchase_type to purchases table
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_type TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchase_name TEXT;

-- 6. Create supplier_transactions table
CREATE TABLE IF NOT EXISTS supplier_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_method TEXT NOT NULL,
    cheque_date DATE,
    remarks TEXT
);

-- 7. Rename transaction_type to transaction_mode
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supplier_transactions' AND column_name = 'transaction_type') THEN
        ALTER TABLE supplier_transactions RENAME COLUMN transaction_type TO transaction_mode;
    END IF;
END $$;

-- 8. Add new transaction_type column (Paid/Received)
ALTER TABLE supplier_transactions ADD COLUMN transaction_type VARCHAR(50) DEFAULT 'Paid';
