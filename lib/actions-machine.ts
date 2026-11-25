'use server';

import { requireAdmin } from './require-admin';
import { getProductsServer } from './products-server';
import { displayTitle } from './format';
import { sendTelegramText, telegramConfigured } from './notify';
import { deleteOrder, getOrdersOverview, listOrders, saveOrder, setOrderStatus, settleOrder, type OrdersOverview } from './orders';
import { machineReportText, getMachineSnapshot, runMachineStep } from './machine-store';
import { OrderInputSchema, OrderStatusSchema } from './finance-schemas';
import type { Order, OrderStatus } from './orders-utils';
import type { MachineSnapshot } from './machine';
import type { PickerProduct } from './actions-finance';

/** Genel Bakış: durum sayıları, geciken ve bugün teslim edilecek işler. */
export async function getMachineOverviewAction(): Promise<OrdersOverview> {
  await requireAdmin();
  return getOrdersOverview(Date.now());
}

export interface MachineData {
  orders: Order[];
  products: PickerProduct[];
  snapshot: MachineSnapshot | null;
  telegram: boolean;
  now: number;
}

/** Makine sayfası verisi: işler, ürün seçici ve günlük özet. */
export async function getMachineDataAction(): Promise<MachineData> {
  await requireAdmin();
  const [orders, products, snapshot] = await Promise.all([listOrders(), getProductsServer(), getMachineSnapshot()]);
  return {
    orders,
    products: products.map((p) => ({ id: p.id, title: displayTitle(p.title), category: p.category, priceMin: p.priceMin })),
    snapshot,
    telegram: telegramConfigured(),
    now: Date.now(),
  };
}

type OrderForm = Parameters<typeof saveOrder>[0];

export async function saveOrderAction(data: OrderForm, id?: string): Promise<string> {
  await requireAdmin();
  const parsed = OrderInputSchema.safeParse(data);
  if (!parsed.success) throw new Error('İş bilgileri geçersiz.');
  return saveOrder(parsed.data, id);
}

/** Durumu ilerletir/değiştirir; teslimde otomatik muhasebeye işlenir. Güncel işi döner. */
export async function setOrderStatusAction(id: string, status: OrderStatus): Promise<Order> {
  await requireAdmin();
  const s = OrderStatusSchema.safeParse(status);
  if (!s.success) throw new Error('Geçersiz durum.');
  return setOrderStatus(id, s.data);
}

/** "Muhasebeye işle": teslim edilmiş işin satış satırlarını oluşturur (tekrar basılsa çift kayıt olmaz). */
export async function settleOrderAction(id: string): Promise<number> {
  await requireAdmin();
  return settleOrder(id);
}

export async function deleteOrderAction(id: string): Promise<void> {
  await requireAdmin();
  await deleteOrder(id);
}

/** Günlük özeti hemen tazeler (zorla). */
export async function refreshMachineAction(): Promise<MachineSnapshot | null> {
  await requireAdmin();
  await runMachineStep(Date.now(), true);
  return getMachineSnapshot();
}

/** Haftalık raporu şimdi Telegram'a yollar. Telegram bağlı değilse false. */
export async function sendMachineReportAction(): Promise<boolean> {
  await requireAdmin();
  if (!telegramConfigured()) return false;
  return sendTelegramText(await machineReportText(Date.now(), 7));
}
