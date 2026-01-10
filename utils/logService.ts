// 日志服务 - 用于保存和管理清理日志
// Log service for saving and managing cleaning logs

import { type TranslationKey } from './i18n';

export interface LogEntry {
    id: string;
    timestamp: number;
    type: 'info' | 'success' | 'warning' | 'error';
    // 国际化支持：存储翻译 key 和参数，显示时再翻译
    messageKey: TranslationKey;
    messageParams?: Record<string, string | number>;
    detailsKey?: TranslationKey;
    detailsParams?: Record<string, string | number>;
}

// 存储 key
const LOG_STORAGE_KEY = 'clearly_logs';
// 最大日志条数
const MAX_LOG_COUNT = 200;

// 生成唯一 ID
function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 获取所有日志
export async function getLogs(): Promise<LogEntry[]> {
    const result = await browser.storage.local.get(LOG_STORAGE_KEY);
    const logs = result[LOG_STORAGE_KEY];
    return Array.isArray(logs) ? logs : [];
}

// 添加日志
export async function addLog(
    type: LogEntry['type'],
    messageKey: TranslationKey,
    messageParams?: Record<string, string | number>,
    detailsKey?: TranslationKey,
    detailsParams?: Record<string, string | number>
): Promise<void> {
    const logs = await getLogs();

    const newLog: LogEntry = {
        id: generateId(),
        timestamp: Date.now(),
        type,
        messageKey,
        messageParams,
        detailsKey,
        detailsParams,
    };

    logs.unshift(newLog);

    if (logs.length > MAX_LOG_COUNT) {
        logs.splice(MAX_LOG_COUNT);
    }

    await browser.storage.local.set({ [LOG_STORAGE_KEY]: logs });
}

// 清空所有日志
export async function clearLogs(): Promise<void> {
    await browser.storage.local.set({ [LOG_STORAGE_KEY]: [] });
}

// 日志快捷方法
export const log = {
    info: (
        messageKey: TranslationKey,
        messageParams?: Record<string, string | number>,
        detailsKey?: TranslationKey,
        detailsParams?: Record<string, string | number>
    ) => addLog('info', messageKey, messageParams, detailsKey, detailsParams),

    success: (
        messageKey: TranslationKey,
        messageParams?: Record<string, string | number>,
        detailsKey?: TranslationKey,
        detailsParams?: Record<string, string | number>
    ) => addLog('success', messageKey, messageParams, detailsKey, detailsParams),

    warning: (
        messageKey: TranslationKey,
        messageParams?: Record<string, string | number>,
        detailsKey?: TranslationKey,
        detailsParams?: Record<string, string | number>
    ) => addLog('warning', messageKey, messageParams, detailsKey, detailsParams),

    error: (
        messageKey: TranslationKey,
        messageParams?: Record<string, string | number>,
        detailsKey?: TranslationKey,
        detailsParams?: Record<string, string | number>
    ) => addLog('error', messageKey, messageParams, detailsKey, detailsParams),
};
