// 历史记录项类型定义
export interface HistoryItem {
    id: string;
    url: string;
    title: string;
    lastVisitTime: number;
    visitCount: number;
}

// 搜索历史记录
export async function searchHistory(query: string, maxResults: number = 1000): Promise<HistoryItem[]> {
    const results = await browser.history.search({
        text: query,
        maxResults,
        startTime: 0, // 从最早的记录开始
    });

    return results.map((item) => ({
        id: item.id || '',
        url: item.url || '',
        title: item.title || item.url || '无标题',
        lastVisitTime: item.lastVisitTime || 0,
        visitCount: item.visitCount || 0,
    }));
}

// 删除单条历史记录
export async function deleteHistoryItem(url: string): Promise<void> {
    await browser.history.deleteUrl({ url });
}

// 批量删除历史记录
export async function deleteHistoryByUrls(urls: string[]): Promise<number> {
    let deletedCount = 0;
    for (const url of urls) {
        try {
            await browser.history.deleteUrl({ url });
            deletedCount++;
        } catch (e) {
            console.error(`删除失败: ${url}`, e);
        }
    }
    return deletedCount;
}

// 精确子域名匹配
// 规则 "baidu.com" 匹配 "baidu.com" 和 "*.baidu.com"
// 但不会误匹配 "fakebaidu.com" 或 "baidu.com.cn"
function isSubdomainMatch(hostname: string, domain: string): boolean {
    // 统一转为小写进行比较
    const h = hostname.toLowerCase();
    const d = domain.toLowerCase();

    // 完全相等
    if (h === d) return true;

    // 子域名匹配：hostname 以 ".domain" 结尾
    // 例如 "www.baidu.com" 以 ".baidu.com" 结尾
    if (h.endsWith('.' + d)) return true;

    return false;
}

// 根据域名匹配删除历史记录
export async function deleteHistoryByDomain(domain: string): Promise<number> {
    const items = await searchHistory(domain);
    const matchedUrls = items
        .filter((item) => {
            try {
                const url = new URL(item.url);
                return isSubdomainMatch(url.hostname, domain);
            } catch {
                // URL 解析失败时，回退到简单包含匹配
                return item.url.toLowerCase().includes(domain.toLowerCase());
            }
        })
        .map((item) => item.url);

    return deleteHistoryByUrls(matchedUrls);
}

// 根据关键词匹配删除历史记录
export async function deleteHistoryByKeyword(keyword: string): Promise<number> {
    const items = await searchHistory(keyword);
    const matchedUrls = items
        .filter((item) => item.url.includes(keyword) || item.title.includes(keyword))
        .map((item) => item.url);

    return deleteHistoryByUrls(matchedUrls);
}

// 获取最近的历史记录（用于默认展示）
export async function getRecentHistory(maxResults: number = 200): Promise<HistoryItem[]> {
    return searchHistory('', maxResults);
}

// 按时间范围删除历史记录
// startTime: 起始时间戳（毫秒），删除从 startTime 到当前时间的所有记录
export async function deleteHistoryByTimeRange(startTime: number): Promise<number> {
    // 先查询该时间范围内有多少条记录，用于返回计数
    const results = await browser.history.search({
        text: '',
        startTime,
        maxResults: 10000,
    });
    const count = results.length;

    // 使用 deleteRange API 批量删除
    await browser.history.deleteRange({
        startTime,
        endTime: Date.now(),
    });

    return count;
}

// 根据域名清理匹配的下载记录（仅从下载列表中抹除，不删除文件）
export async function eraseDownloadsByDomain(domain: string): Promise<number> {
    try {
        const downloads = await browser.downloads.search({});
        let erasedCount = 0;
        for (const item of downloads) {
            try {
                const url = new URL(item.url);
                if (isSubdomainMatch(url.hostname, domain)) {
                    await browser.downloads.erase({ id: item.id });
                    erasedCount++;
                }
            } catch {
                // URL 解析失败则跳过
            }
        }
        return erasedCount;
    } catch (e) {
        console.error('[Clearly] 清理下载记录失败:', e);
        return 0;
    }
}

// 根据关键词清理匹配的下载记录（仅从下载列表中抹除，不删除文件）
export async function eraseDownloadsByKeyword(keyword: string): Promise<number> {
    try {
        const downloads = await browser.downloads.search({});
        let erasedCount = 0;
        const kw = keyword.toLowerCase();
        for (const item of downloads) {
            const urlMatch = item.url.toLowerCase().includes(kw);
            const filenameMatch = (item.filename || '').toLowerCase().includes(kw);
            if (urlMatch || filenameMatch) {
                await browser.downloads.erase({ id: item.id });
                erasedCount++;
            }
        }
        return erasedCount;
    } catch (e) {
        console.error('[Clearly] 清理下载记录失败:', e);
        return 0;
    }
}

// 检查单个 URL 是否匹配某个域名规则
export function urlMatchesDomain(url: string, domain: string): boolean {
    try {
        const parsed = new URL(url);
        return isSubdomainMatch(parsed.hostname, domain);
    } catch {
        return url.toLowerCase().includes(domain.toLowerCase());
    }
}

// 检查单个 URL/标题是否匹配关键词规则
export function urlMatchesKeyword(url: string, title: string, keyword: string): boolean {
    const kw = keyword.toLowerCase();
    return url.toLowerCase().includes(kw) || title.toLowerCase().includes(kw);
}
