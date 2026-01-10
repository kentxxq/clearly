import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'History Cleaner - 历史记录清理',
    description: '快速搜索、过滤和清理浏览器历史记录，支持自动定时清理',
    permissions: ['history', 'storage', 'alarms'],
  },
});
