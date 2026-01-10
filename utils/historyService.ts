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

// 根据域名匹配删除历史记录
export async function deleteHistoryByDomain(domain: string): Promise<number> {
    const items = await searchHistory(domain);
    const matchedUrls = items
        .filter((item) => {
            try {
                const url = new URL(item.url);
                return url.hostname.includes(domain);
            } catch {
                return item.url.includes(domain);
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
