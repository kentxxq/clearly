import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: '__MSG_extension_name__',
    description: '__MSG_extension_description__',
    permissions: ['history', 'storage', 'alarms'],
    default_locale: 'en',
  },
});

