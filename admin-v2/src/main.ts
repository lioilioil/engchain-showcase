import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import './styles/tokens.css';
import './styles/components.css';
import './styles/element-overrides.scss';
import './styles/global.scss';

// 等旧 DataBus 脚本加载完再挂载，避免首屏空数据
function waitForDataBus(timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).DataBus) return resolve();
    const start = Date.now();
    const timer = setInterval(() => {
      if ((window as any).DataBus || Date.now() - start > timeout) {
        clearInterval(timer);
        resolve();
      }
    }, 50);
  });
}

waitForDataBus().then(() => {
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.use(ElementPlus);
  app.mount('#app');
});
