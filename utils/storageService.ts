import { storage } from '#imports';

// 自动清理规则类型
export interface CleanRule {
    id: string;
    type: 'domain' | 'keyword'; // 域名匹配或关键词匹配
    value: string; // 匹配的值
    enabled: boolean; // 是否启用
    createdAt: number; // 创建时间
}

// 存储键定义
const RULES_KEY = 'local:autoCleanRules';

// 获取所有自动清理规则
export async function getAutoCleanRules(): Promise<CleanRule[]> {
    const rules = await storage.getItem<CleanRule[]>(RULES_KEY);
    return rules || [];
}

// 添加自动清理规则
export async function addAutoCleanRule(
    type: 'domain' | 'keyword',
    value: string
): Promise<CleanRule> {
    const rules = await getAutoCleanRules();

    // 检查是否已存在相同规则
    const exists = rules.some((r) => r.type === type && r.value === value);
    if (exists) {
        throw new Error('规则已存在');
    }

    const newRule: CleanRule = {
        id: Date.now().toString(),
        type,
        value,
        enabled: true,
        createdAt: Date.now(),
    };

    rules.push(newRule);
    await storage.setItem(RULES_KEY, rules);

    return newRule;
}

// 删除自动清理规则
export async function removeAutoCleanRule(id: string): Promise<void> {
    const rules = await getAutoCleanRules();
    const filtered = rules.filter((r) => r.id !== id);
    await storage.setItem(RULES_KEY, filtered);
}

// 切换规则启用状态
export async function toggleAutoCleanRule(id: string): Promise<void> {
    const rules = await getAutoCleanRules();
    const rule = rules.find((r) => r.id === id);
    if (rule) {
        rule.enabled = !rule.enabled;
        await storage.setItem(RULES_KEY, rules);
    }
}

// 获取所有启用的规则
export async function getEnabledRules(): Promise<CleanRule[]> {
    const rules = await getAutoCleanRules();
    return rules.filter((r) => r.enabled);
}
