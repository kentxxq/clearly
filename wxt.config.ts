import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  outDir: 'dist', // 修改输出目录名称，默认是 .output
  webExt: {
    startUrls: ['https://www.baidu.com'], // dev 调试时自动打开百度
  },
  manifest: {
    name: '__MSG_extension_name__',
    description: '__MSG_extension_description__',
    permissions: ['history', 'storage', 'alarms', 'contextMenus', 'downloads'],
    default_locale: 'en',
  },
});

