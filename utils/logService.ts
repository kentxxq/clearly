// 日志服务 - 用于保存和管理清理日志
// Log service for saving and managing cleaning logs

export interface LogEntry {
    id: string;
    timestamp: number;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: string;
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
    message: string,
    details?: string
): Promise<void> {
    const logs = await getLogs();

    const newLog: LogEntry = {
        id: generateId(),
        timestamp: Date.now(),
        type,
        message,
        details,
    };

    // 添加新日志到开头
    logs.unshift(newLog);

    // 保持最大条数限制
    if (logs.length > MAX_LOG_COUNT) {
        logs.splice(MAX_LOG_COUNT);
    }

    await browser.storage.local.set({ [LOG_STORAGE_KEY]: logs });
}

// 清空所有日志
export async function clearLogs(): Promise<void> {
    await browser.storage.local.set({ [LOG_STORAGE_KEY]: [] });
}

// 快捷方法
export const log = {
    info: (message: string, details?: string) => addLog('info', message, details),
    success: (message: string, details?: string) => addLog('success', message, details),
    warning: (message: string, details?: string) => addLog('warning', message, details),
    error: (message: string, details?: string) => addLog('error', message, details),
};
