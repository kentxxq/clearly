import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  outDir: 'dist', // 修改输出目录名称，默认是 .output
  manifest: {
    name: '__MSG_extension_name__',
    description: '__MSG_extension_description__',
    permissions: ['history', 'storage', 'alarms'],
    default_locale: 'en',
  },
});

