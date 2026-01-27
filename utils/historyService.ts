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
