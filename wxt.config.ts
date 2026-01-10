import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Clearly - 浏览记录清理',
    description: '让浏览历史保持清爽，支持搜索过滤和自动定时清理',
    permissions: ['history', 'storage', 'alarms'],
  },
});
