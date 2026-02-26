// 国际化服务 - 支持中英文切换
// Internationalization service - supports Chinese and English switching

export type Language = 'zh' | 'en';

// 语言存储 key
const LANGUAGE_STORAGE_KEY = 'clearly_language';

// 翻译映射表
export const translations = {
    // 通用
    appName: {
        zh: '✨ Clearly',
        en: '✨ Clearly',
    },

    // 标签页
    tabSearch: {
        zh: '📜 历史',
        en: '📜 History',
    },
    tabRules: {
        zh: '⚙️ 规则',
        en: '⚙️ Rules',
    },
    tabLogs: {
        zh: '📋 日志',
        en: '📋 Logs',
    },

    // 搜索面板
    searchPlaceholder: {
        zh: '搜索历史记录...',
        en: 'Search history...',
    },
    searchBtn: {
        zh: '搜索',
        en: 'Search',
    },
    selectAll: {
        zh: '全选',
        en: 'Select All',
    },
    deleteSelected: {
        zh: '🗑️ 删除选中',
        en: '🗑️ Delete Selected',
    },
    loading: {
        zh: '加载中...',
        en: 'Loading...',
    },
    emptySearchHint: {
        zh: '暂无历史记录',
        en: 'No history records',
    },
    visit: {
        zh: '访问',
        en: 'visit',
    },
    times: {
        zh: '次',
        en: 'times',
    },
    deleteSuccess: {
        zh: '成功删除 {count} 条记录',
        en: 'Successfully deleted {count} records',
    },
    deleteFailed: {
        zh: '删除失败，请重试',
        en: 'Delete failed, please retry',
    },

    // 快捷清理
    quickClean: {
        zh: '⚡ 快捷清理',
        en: '⚡ Quick Clean',
    },
    cleanLastHour: {
        zh: '最近 1 小时',
        en: 'Last 1 Hour',
    },
    cleanLast3Hours: {
        zh: '最近 3 小时',
        en: 'Last 3 Hours',
    },
    cleanLastDay: {
        zh: '最近 1 天',
        en: 'Last 1 Day',
    },
    confirmClean: {
        zh: '确定要清理{range}的所有历史记录吗？此操作不可撤销。',
        en: 'Are you sure you want to clean all history from {range}? This action cannot be undone.',
    },
    quickCleanSuccess: {
        zh: '快捷清理完成：{range}，共清理 {count} 条记录',
        en: 'Quick clean done: {range}, cleaned {count} records',
    },
    quickCleanFailed: {
        zh: '快捷清理失败',
        en: 'Quick clean failed',
    },
    manualDeleteSuccess: {
        zh: '手动删除了 {count} 条选中的记录',
        en: 'Manually deleted {count} selected records',
    },
    manualDeleteFailed: {
        zh: '手动删除选中记录失败',
        en: 'Failed to manually delete selected records',
    },

    // 规则设置面板
    settingsDesc: {
        zh: '添加域名或关键词规则，插件将每 1 分钟自动清理匹配的历史记录。',
        en: 'Add domain or keyword rules, the extension will auto-clean matching history every 1 minute.',
    },
    typeDomain: {
        zh: '域名',
        en: 'Domain',
    },
    typeKeyword: {
        zh: '关键词',
        en: 'Keyword',
    },
    domainPlaceholder: {
        zh: '例如: example.com',
        en: 'e.g.: example.com',
    },
    keywordPlaceholder: {
        zh: '例如: 购物',
        en: 'e.g.: shopping',
    },
    addBtn: {
        zh: '添加',
        en: 'Add',
    },
    enabled: {
        zh: '已启用',
        en: 'Enabled',
    },
    disabled: {
        zh: '已禁用',
        en: 'Disabled',
    },
    deleteBtn: {
        zh: '删除',
        en: 'Delete',
    },
    emptyRulesHint: {
        zh: '暂无自动清理规则',
        en: 'No auto-clean rules yet',
    },

    // 日志面板
    logsCount: {
        zh: '共 {count} 条日志',
        en: '{count} logs in total',
    },
    clearLogs: {
        zh: '🗑️ 清空日志',
        en: '🗑️ Clear Logs',
    },
    nextClean: {
        zh: '⏱️ 下次清理',
        en: '⏱️ Next Clean',
    },
    cleanCycle: {
        zh: '🔄 清理周期',
        en: '🔄 Clean Cycle',
    },
    emptyLogsHint: {
        zh: '暂无运行日志',
        en: 'No logs yet',
    },
    notSet: {
        zh: '未设置',
        en: 'Not set',
    },
    executing: {
        zh: '正在执行...',
        en: 'Executing...',
    },
    minutes: {
        zh: '分',
        en: 'm ',
    },
    seconds: {
        zh: '秒',
        en: 's',
    },

    // 后台脚本日志消息
    logStartClean: {
        zh: '开始执行自动清理',
        en: 'Starting auto-clean',
    },
    logGotRules: {
        zh: '获取到 {count} 条启用的规则',
        en: 'Got {count} enabled rules',
    },
    logNoRules: {
        zh: '没有启用的规则，跳过清理',
        en: 'No enabled rules, skipping clean',
    },
    logRuleClean: {
        zh: '规则 "{value}" 清理了 {count} 条记录',
        en: 'Rule "{value}" cleaned {count} records',
    },
    logCleanDone: {
        zh: '自动清理完成，共清理 {count} 条记录',
        en: 'Auto-clean done, cleaned {count} records',
    },
    logNoMatch: {
        zh: '自动清理完成，没有匹配的记录需要清理',
        en: 'Auto-clean done, no matching records to clean',
    },
    logCleanFailed: {
        zh: '自动清理失败',
        en: 'Auto-clean failed',
    },
    logAlarmSet: {
        zh: '定时器已设置，每 {interval} 分钟执行一次清理',
        en: 'Timer set, will clean every {interval} minutes',
    },
    logAlarmSuccess: {
        zh: '定时器创建成功',
        en: 'Timer created successfully',
    },
    logNextTime: {
        zh: '下次执行时间: {time}',
        en: 'Next execution: {time}',
    },
    logAlarmFailed: {
        zh: '定时器创建失败',
        en: 'Timer creation failed',
    },
    logBgStarted: {
        zh: '后台脚本已启动',
        en: 'Background script started',
    },
    logInstalled: {
        zh: '扩展已安装/更新',
        en: 'Extension installed/updated',
    },
    logReason: {
        zh: '原因: {reason}',
        en: 'Reason: {reason}',
    },
    logInstallClean: {
        zh: '安装后立即执行一次清理',
        en: 'Running initial clean after install',
    },

    // 语言切换
    switchLanguage: {
        zh: 'EN',
        en: '中',
    },
} as const;

// 翻译 key 类型
export type TranslationKey = keyof typeof translations;

// 当前语言（默认中文）
let currentLanguage: Language = 'zh';

// 获取保存的语言设置
export async function getStoredLanguage(): Promise<Language> {
    try {
        const result = await browser.storage.local.get(LANGUAGE_STORAGE_KEY);
        const lang = result[LANGUAGE_STORAGE_KEY];
        if (lang === 'zh' || lang === 'en') {
            currentLanguage = lang;
            return lang;
        }
    } catch (error) {
        console.error('Failed to get language:', error);
    }
    return 'zh';
}

// 保存语言设置
export async function setStoredLanguage(lang: Language): Promise<void> {
    currentLanguage = lang;
    await browser.storage.local.set({ [LANGUAGE_STORAGE_KEY]: lang });
}

// 获取当前语言
export function getCurrentLanguage(): Language {
    return currentLanguage;
}

// 设置当前语言（内存中）
export function setCurrentLanguage(lang: Language): void {
    currentLanguage = lang;
}

// 翻译函数
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const translation = translations[key];
    if (!translation) {
        console.warn(`Translation key not found: ${key}`);
        return key;
    }

    let text: string = translation[currentLanguage] || translation['zh'];

    // 替换参数，例如 {count} -> 实际值
    if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
        }
    }

    return text;
}

// 带语言参数的翻译函数（用于后台脚本等无法使用响应式的场景）
export function tWithLang(lang: Language, key: TranslationKey, params?: Record<string, string | number>): string {
    const translation = translations[key];
    if (!translation) {
        console.warn(`Translation key not found: ${key}`);
        return key;
    }

    let text: string = translation[lang] || translation['zh'];

    if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
        }
    }

    return text;
}
