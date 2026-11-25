import { z } from 'zod';
import { SALE_CHANNELS } from './finance-types';
import { EXPENSE_CATEGORIES } from './expense-types';
import { ORDER_STATUSES } from './orders-utils';

// Sunucu eylemlerinde gelen veriyi doğrular (istemciye güvenilmez).
const money = z.number().finite().min(0).max(10_000_000);
const text = (max: number) => z.string().trim().max(max);

export const SaleInputSchema = z.object({
  date: z.number().int().positive(),
  productId: text(120).optional(),
  title: text(200).min(1),
  category: text(80).min(1),
  qty: z.number().int().min(1).max(100000),
  unitPrice: money,
  unitCost: money.nullable().optional(),
  extraCost: money.optional(),
  channel: z.enum(SALE_CHANNELS),
  customerName: text(120).optional(),
  note: text(300).optional(),
  orderId: text(120).optional(),
  sepetTalebiId: text(120).optional(),
});

export const ExpenseInputSchema = z.object({
  date: z.number().int().positive(),
  category: z.enum(EXPENSE_CATEGORIES),
  amountTRY: z.number().finite().positive().max(10_000_000),
  note: text(200).optional(),
});

export const RecurringInputSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amountTRY: z.number().finite().positive().max(10_000_000),
  dayOfMonth: z.number().int().min(1).max(31),
  startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  note: text(200).optional(),
  active: z.boolean(),
});

export const OrderItemSchema = z.object({
  productId: text(120).optional(),
  title: text(200).min(1),
  category: text(80).optional(),
  qty: z.number().int().min(1).max(100000),
  unitPrice: money,
  unitCost: money.nullable().optional(),
  color: text(60).optional(),
  note: text(300).optional(),
});

export const OrderInputSchema = z.object({
  items: z.array(OrderItemSchema).min(1).max(30),
  customerName: text(120).optional(),
  phone: text(40).optional(),
  channel: z.enum(SALE_CHANNELS),
  note: text(500).optional(),
  extraCost: money.optional(),
  dueAt: z.number().int().positive().optional(),
});

export const OrderStatusSchema = z.enum(ORDER_STATUSES);
