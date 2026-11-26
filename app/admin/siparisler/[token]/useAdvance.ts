'use client';

import { setOrderStatusAction } from '@/lib/actions-machine';
import { ORDER_STATUS_LABELS, nextStatus } from '@/lib/orders-utils';
import type { Production } from '@/lib/siparis-takip';
import type { OrderRequest } from '@/lib/siparis-types';
import type { useConfirm } from '@/components/admin/ConfirmDialog';
import { errorMessage, useToast } from '@/components/admin/Toast';

/** Üretim hattındaki işi bir sonraki aşamaya geçirir (teslimde önce onay ister). */
export function useAdvance(
  order: OrderRequest | null,
  production: Production | null,
  confirm: ReturnType<typeof useConfirm>['confirm'],
  onDone: (production: Production) => void,
  setBusy: (busy: boolean) => void,
) {
  const toast = useToast();
  return async () => {
    const next = production ? nextStatus(production.status) : null;
    if (!next || !order?.orderId) return;
    if (next === 'teslim') {
      const ok = await confirm({
        title: 'Teslim edildi olarak işaretlensin mi?',
        message: 'İş muhasebeye işlenir ve sipariş fotoğrafları için 30 günlük saklama süresi başlar.',
        confirmLabel: 'Teslim edildi',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const job = await setOrderStatusAction(order.orderId, next);
      onDone({ status: job.status, stageAt: job.stageAt });
      toast.success(`Aşama: ${ORDER_STATUS_LABELS[next]}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
}
