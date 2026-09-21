/**
 * 旧 DataBus 桥接层
 * 旧 JS 挂在 window.DataBus / window.AdminCredits / window.CorpPay / window.Mediation 等，
 * 这里做类型化访问 + 跨标签页同步 + 异步三态封装。
 */
import { ref } from 'vue';

declare global {
  interface Window {
    DataBus?: any;
    Admin?: any;
    AdminCredits?: any;
    CorpPay?: any;
    Mediation?: any;
    BalanceStore?: any;
    RevenueStore?: any;
  }
}

export function useBus() {
  const bus = () => window.DataBus;
  const admin = () => window.Admin;
  return { bus, admin };
}

/** 等待 DataBus 就绪（旧 JS 是 defer 加载） */
export function whenBusReady(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.DataBus) return resolve();
    const start = Date.now();
    const timer = setInterval(() => {
      if (window.DataBus) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error('DataBus 加载超时'));
      }
    }, 50);
  });
}

/**
 * 跨标签页数据同步：监听 localStorage 变化 + DataBus 自定义事件，
 * 后台改了数据，C 端标签页自动触发 reload 回调。
 */
export function useBusWatch(cb: () => void) {
  const handler = () => cb();
  const storageHandler = (e: StorageEvent) => {
    if (e.key && e.key.startsWith('engchain-')) cb();
  };
  window.addEventListener('storage', storageHandler);
  window.addEventListener('engchain:supply', handler);
  window.addEventListener('engchain:orders', handler);
  window.addEventListener('engchain:mediation', handler);
  window.addEventListener('engchain:messages', handler);
  window.addEventListener('engchain:admin-credits', handler);
  window.addEventListener('engchain:phase', handler);
  window.addEventListener('engchain:pricing', handler);
  return () => {
    window.removeEventListener('storage', storageHandler);
    window.removeEventListener('engchain:supply', handler);
    window.removeEventListener('engchain:orders', handler);
    window.removeEventListener('engchain:mediation', handler);
    window.removeEventListener('engchain:messages', handler);
    window.removeEventListener('engchain:admin-credits', handler);
    window.removeEventListener('engchain:phase', handler);
    window.removeEventListener('engchain:pricing', handler);
  };
}

/**
 * 异步数据加载三态封装：loading / error / data
 * const { data, loading, error, reload } = useAsync(() => DataBus.users());
 */
export function useAsync<T>(fn: () => T, immediate = true) {
  const data = ref<T | null>(null);
  const loading = ref(false);
  const error = ref<string>('');

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      // 等一帧让 loading 态渲染
      await new Promise(r => setTimeout(r, 0));
      data.value = fn();
    } catch (e: any) {
      error.value = e?.message || '加载失败';
      console.error('[useAsync]', e);
    } finally {
      loading.value = false;
    }
  }

  if (immediate) load();
  return { data, loading, error, reload: load };
}
