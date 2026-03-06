<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
  searchHistory,
  deleteHistoryByUrls,
  getRecentHistory,
  deleteHistoryByTimeRange,
  type HistoryItem,
} from '@/utils/historyService';
import {
  getAutoCleanRules,
  addAutoCleanRule,
  removeAutoCleanRule,
  toggleAutoCleanRule,
  type CleanRule,
} from '@/utils/storageService';
import { getLogs, clearLogs, log, type LogEntry } from '@/utils/logService';
import {
  t,
  getCurrentLanguage,
  setCurrentLanguage,
  getStoredLanguage,
  setStoredLanguage,
  type Language,
} from '@/utils/i18n';

// 当前语言
const currentLang = ref<Language>('zh');

// 当前标签页
const activeTab = ref<'search' | 'settings' | 'logs'>('search');

// 搜索相关状态
const searchQuery = ref('');
const historyItems = ref<HistoryItem[]>([]);
const isLoading = ref(false);
const selectedUrls = ref<Set<string>>(new Set());
const isQuickCleaning = ref(false);

// Toast 相关状态
const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');
const toastVisible = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

// 显示 Toast 提示
function showToast(message: string, type: 'success' | 'error' = 'success') {
  // 清除上一个定时器
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 2500);
}

// 设置相关状态
const rules = ref<CleanRule[]>([]);
const newRuleType = ref<'domain' | 'keyword'>('domain');
const newRuleValue = ref('');

// 日志相关状态
const logs = ref<LogEntry[]>([]);
const isLoadingLogs = ref(false);

// 倒计时相关状态
const nextCleanTime = ref<number | null>(null);
const countdown = ref('');
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// 多语言包装函数，确保响应式更新
const i18n = computed(() => ({
  lang: currentLang.value,
}));

// 翻译函数包装（触发响应式） 
function tr(key: Parameters<typeof t>[0], params?: Record<string, string | number>): string {
  // 依赖 i18n.value.lang 确保语言切换时重新计算
  const _ = i18n.value.lang;
  return t(key, params);
}

// 切换语言
async function toggleLanguage() {
  const newLang: Language = currentLang.value === 'zh' ? 'en' : 'zh';
  currentLang.value = newLang;
  setCurrentLanguage(newLang);
  await setStoredLanguage(newLang);
}

// 获取下次清理时间
async function loadNextCleanTime() {
  try {
    const alarm = await browser.alarms.get('auto-clean-history');
    if (alarm) {
      nextCleanTime.value = alarm.scheduledTime;
    }
  } catch (error) {
    console.error('获取定时器信息失败:', error);
  }
}

// 更新倒计时显示
function updateCountdown() {
  if (!nextCleanTime.value) {
    countdown.value = tr('notSet');
    return;
  }
  
  const now = Date.now();
  const diff = nextCleanTime.value - now;
  
  if (diff <= 0) {
    countdown.value = tr('executing');
    // 重新获取下次时间
    loadNextCleanTime();
    return;
  }
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  countdown.value = `${minutes}${tr('minutes')}${remainingSeconds.toString().padStart(2, '0')}${tr('seconds')}`;
}

// 启动倒计时定时器
function startCountdownTimer() {
  // 立即更新一次
  updateCountdown();
  // 每秒更新
  countdownTimer = setInterval(updateCountdown, 1000);
}

// 停止倒计时定时器
function stopCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

// 加载最近历史记录
async function loadRecentHistory() {
  isLoading.value = true;
  try {
    historyItems.value = await getRecentHistory();
    selectedUrls.value = new Set();
  } catch (error) {
    console.error('加载历史记录失败:', error);
  } finally {
    isLoading.value = false;
  }
}

// 搜索历史记录
async function handleSearch() {
  isLoading.value = true;
  try {
    if (!searchQuery.value.trim()) {
      // 空查询加载最近历史
      historyItems.value = await getRecentHistory();
    } else {
      historyItems.value = await searchHistory(searchQuery.value.trim());
    }
    selectedUrls.value = new Set();
  } catch (error) {
    console.error('搜索失败:', error);
  } finally {
    isLoading.value = false;
  }
}

// 快捷清理：按时间范围清理历史记录
async function handleQuickClean(hours: number) {
  // 获取时间范围文案
  let rangeKey: 'cleanLastHour' | 'cleanLast3Hours' | 'cleanLastDay';
  if (hours === 1) rangeKey = 'cleanLastHour';
  else if (hours === 3) rangeKey = 'cleanLast3Hours';
  else rangeKey = 'cleanLastDay';

  const rangeText = tr(rangeKey);

  isQuickCleaning.value = true;
  try {
    const startTime = Date.now() - hours * 60 * 60 * 1000;
    const count = await deleteHistoryByTimeRange(startTime);
    const now = new Date().toLocaleString();

    // 记录到日志
    await log.success('quickCleanSuccess', { range: rangeText, count });

    showToast(tr('deleteSuccess', { count }), 'success');

    // 刷新历史列表
    await loadRecentHistory();
  } catch (error) {
    console.error('快捷清理失败:', error);
    await log.error('quickCleanFailed', { error: String(error) });
    showToast(tr('deleteFailed'), 'error');
  } finally {
    isQuickCleaning.value = false;
  }
}

// 全选/取消全选
const isAllSelected = computed(() => {
  return (
    historyItems.value.length > 0 &&
    historyItems.value.every((item) => selectedUrls.value.has(item.url))
  );
});

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedUrls.value.clear();
  } else {
    historyItems.value.forEach((item) => selectedUrls.value.add(item.url));
  }
  // 触发响应式更新
  selectedUrls.value = new Set(selectedUrls.value);
}

function toggleSelect(url: string) {
  if (selectedUrls.value.has(url)) {
    selectedUrls.value.delete(url);
  } else {
    selectedUrls.value.add(url);
  }
  selectedUrls.value = new Set(selectedUrls.value);
}

// 删除选中的记录
async function deleteSelected() {
  if (selectedUrls.value.size === 0) return;

  const urlsToDelete = Array.from(selectedUrls.value);
  isLoading.value = true;

  try {
    const deleted = await deleteHistoryByUrls(urlsToDelete);
    // 从列表中移除已删除的项
    historyItems.value = historyItems.value.filter(
      (item) => !selectedUrls.value.has(item.url)
    );
    selectedUrls.value.clear();
    // 记录到日志
    await log.success('manualDeleteSuccess', { count: deleted });
    showToast(tr('deleteSuccess', { count: deleted }), 'success');
  } catch (error) {
    console.error('删除失败:', error);
    await log.error('manualDeleteFailed', { error: String(error) });
    showToast(tr('deleteFailed'), 'error');
  } finally {
    isLoading.value = false;
  }
}

// 加载规则列表
async function loadRules() {
  rules.value = await getAutoCleanRules();
}

// 添加规则
async function handleAddRule() {
  if (!newRuleValue.value.trim()) return;

  try {
    await addAutoCleanRule(newRuleType.value, newRuleValue.value.trim());
    newRuleValue.value = '';
    await loadRules();
  } catch (error: any) {
    showToast(error.message || 'Failed to add rule', 'error');
  }
}

// 删除规则
async function handleRemoveRule(id: string) {
  await removeAutoCleanRule(id);
  await loadRules();
}

// 切换规则状态
async function handleToggleRule(id: string) {
  await toggleAutoCleanRule(id);
  await loadRules();
}

// 加载日志
async function loadLogs() {
  isLoadingLogs.value = true;
  try {
    logs.value = await getLogs();
  } catch (error) {
    console.error('加载日志失败:', error);
  } finally {
    isLoadingLogs.value = false;
  }
}

// 清空日志
async function handleClearLogs() {
  await clearLogs();
  logs.value = [];
}

// 判断是否是新的清理周期开始（用于显示分隔线）
// 日志是倒序显示的，"自动清理完成"在视觉上是每个周期的第一条
function isNewCycleStart(log: LogEntry): boolean {
  return log.messageKey === 'logCleanDone' || log.messageKey === 'logNoMatch';
}

// 获取日志消息（支持国际化）
function getLogMessage(log: LogEntry): string {
  // 触发响应式
  const _ = i18n.value.lang;
  return t(log.messageKey, log.messageParams);
}

// 获取日志详情（支持国际化）
function getLogDetails(log: LogEntry): string | undefined {
  // 触发响应式
  const _ = i18n.value.lang;
  
  if (log.detailsKey) {
    return t(log.detailsKey, log.detailsParams);
  }
  return undefined;
}

// 格式化时间
function formatTime(timestamp: number): string {
  const locale = currentLang.value === 'zh' ? 'zh-CN' : 'en-US';
  return new Date(timestamp).toLocaleString(locale);
}

// 截断URL显示
function truncateUrl(url: string, maxLength: number = 50): string {
  return url.length > maxLength ? url.substring(0, maxLength) + '...' : url;
}

// 获取日志类型图标
function getLogIcon(type: LogEntry['type']): string {
  switch (type) {
    case 'success': return '✅';
    case 'error': return '❌';
    case 'warning': return '⚠️';
    default: return 'ℹ️';
  }
}

// 存储变化监听器
function handleStorageChange(changes: Record<string, any>) {
  // 当日志存储发生变化时，自动刷新日志列表
  if ('clearly_logs' in changes) {
    loadLogs();
  }
}

onMounted(async () => {
  // 加载语言设置
  const lang = await getStoredLanguage();
  currentLang.value = lang;
  setCurrentLanguage(lang);
  
  // 自动加载最近历史记录
  loadRecentHistory();
  loadRules();
  // 初始加载日志
  loadLogs();
  // 加载下次清理时间并启动倒计时
  loadNextCleanTime().then(() => {
    startCountdownTimer();
  });
  // 监听存储变化，实现日志自动刷新
  browser.storage.onChanged.addListener(handleStorageChange);
});

// 组件卸载时移除监听器
onUnmounted(() => {
  browser.storage.onChanged.removeListener(handleStorageChange);
  stopCountdownTimer();
});
</script>

<template>
  <div class="container">
    <!-- 标题栏 -->
    <header class="header">
      <h1>{{ tr('appName') }}</h1>
      <!-- 语言切换按钮 -->
      <button class="lang-toggle" @click="toggleLanguage" :title="currentLang === 'zh' ? 'Switch to English' : '切换到中文'">
        {{ tr('switchLanguage') }}
      </button>
    </header>

    <!-- 标签页切换 -->
    <nav class="tabs">
      <button
        :class="['tab-btn', { active: activeTab === 'search' }]"
        @click="activeTab = 'search'"
      >
        {{ tr('tabSearch') }}
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'settings' }]"
        @click="activeTab = 'settings'"
      >
        {{ tr('tabRules') }}
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'logs' }]"
        @click="activeTab = 'logs'; loadLogs()"
      >
        {{ tr('tabLogs') }}
      </button>
    </nav>

    <!-- 搜索清理面板 -->
    <div v-if="activeTab === 'search'" class="panel">
      <!-- 搜索框 -->
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="tr('searchPlaceholder')"
          @keyup.enter="handleSearch"
        />
        <button class="btn-primary" @click="handleSearch" :disabled="isLoading">
          {{ tr('searchBtn') }}
        </button>
      </div>

      <!-- 快捷清理面板 -->
      <div class="quick-clean-panel">
        <span class="quick-clean-title">{{ tr('quickClean') }}</span>
        <div class="quick-clean-buttons">
          <button class="btn-quick" @click="handleQuickClean(1)" :disabled="isQuickCleaning">
            {{ tr('cleanLastHour') }}
          </button>
          <button class="btn-quick" @click="handleQuickClean(3)" :disabled="isQuickCleaning">
            {{ tr('cleanLast3Hours') }}
          </button>
          <button class="btn-quick" @click="handleQuickClean(24)" :disabled="isQuickCleaning">
            {{ tr('cleanLastDay') }}
          </button>
        </div>
      </div>

      <!-- 操作栏 -->
      <div v-if="historyItems.length > 0" class="action-bar">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
          />
          {{ tr('selectAll') }} ({{ selectedUrls.size }}/{{ historyItems.length }})
        </label>
        <button
          class="btn-danger"
          @click="deleteSelected"
          :disabled="selectedUrls.size === 0 || isLoading"
        >
          {{ tr('deleteSelected') }} ({{ selectedUrls.size }})
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading">{{ tr('loading') }}</div>

      <!-- 历史记录列表 -->
      <ul v-else-if="historyItems.length > 0" class="history-list">
        <li v-for="item in historyItems" :key="item.id" class="history-item">
          <input
            type="checkbox"
            :checked="selectedUrls.has(item.url)"
            @change="toggleSelect(item.url)"
          />
          <div class="item-content">
            <div class="item-title">{{ item.title }}</div>
            <div class="item-url">{{ truncateUrl(item.url) }}</div>
            <div class="item-meta">
              {{ formatTime(item.lastVisitTime) }} · {{ tr('visit') }} {{ item.visitCount }} {{ tr('times') }}
            </div>
          </div>
        </li>
      </ul>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <p>{{ tr('emptySearchHint') }}</p>
      </div>
    </div>

    <!-- 自动清理设置面板 -->
    <div v-if="activeTab === 'settings'" class="panel">
      <p class="settings-desc">
        {{ tr('settingsDescV2') }}
      </p>

      <!-- 添加规则表单 -->
      <div class="add-rule-form">
        <select v-model="newRuleType">
          <option value="domain">{{ tr('typeDomain') }}</option>
          <option value="keyword">{{ tr('typeKeyword') }}</option>
        </select>
        <input
          v-model="newRuleValue"
          type="text"
          :placeholder="newRuleType === 'domain' ? tr('domainPlaceholder') : tr('keywordPlaceholder')"
          @keyup.enter="handleAddRule"
        />
        <button class="btn-primary" @click="handleAddRule">{{ tr('addBtn') }}</button>
      </div>

      <!-- 规则列表 -->
      <ul v-if="rules.length > 0" class="rules-list">
        <li v-for="rule in rules" :key="rule.id" class="rule-item">
          <div class="rule-info">
            <span :class="['rule-type', rule.type]">
              {{ rule.type === 'domain' ? tr('typeDomain') : tr('typeKeyword') }}
            </span>
            <span class="rule-value">{{ rule.value }}</span>
          </div>
          <div class="rule-actions">
            <button
              :class="['btn-toggle', { enabled: rule.enabled }]"
              @click="handleToggleRule(rule.id)"
            >
              {{ rule.enabled ? tr('enabled') : tr('disabled') }}
            </button>
            <button class="btn-delete" @click="handleRemoveRule(rule.id)">
              {{ tr('deleteBtn') }}
            </button>
          </div>
        </li>
      </ul>

      <!-- 空规则状态 -->
      <div v-else class="empty-state">
        <p>{{ tr('emptyRulesHint') }}</p>
      </div>
    </div>

    <!-- 日志面板 -->
    <div v-if="activeTab === 'logs'" class="panel">
      <!-- 日志操作栏 -->
      <div class="logs-header">
        <span class="logs-count">{{ tr('logsCount', { count: logs.length }) }}</span>
        <button class="btn-clear" @click="handleClearLogs" :disabled="logs.length === 0">
          {{ tr('clearLogs') }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoadingLogs" class="loading">{{ tr('loading') }}</div>

      <!-- 日志列表 -->
      <ul v-else class="logs-list">
        <!-- 下次清理倒计时（始终显示在最上方） -->
        <li class="cycle-divider next-clean">
          <span class="cycle-label">{{ tr('nextClean') }} · {{ countdown }}</span>
        </li>
        
        <template v-for="(log, index) in logs" :key="log.id">
          <!-- 清理周期分隔线 -->
          <li v-if="isNewCycleStart(log)" class="cycle-divider">
            <span class="cycle-label">{{ tr('cleanCycle') }} · {{ formatTime(log.timestamp) }}</span>
          </li>
          <!-- 日志项 -->
          <li :class="['log-item', log.type]">
            <div class="log-icon">{{ getLogIcon(log.type) }}</div>
            <div class="log-content">
              <div class="log-message">{{ getLogMessage(log) }}</div>
              <div v-if="getLogDetails(log)" class="log-details">{{ getLogDetails(log) }}</div>
              <div class="log-time">{{ formatTime(log.timestamp) }}</div>
            </div>
          </li>
        </template>
        
        <!-- 空日志提示 -->
        <li v-if="logs.length === 0" class="empty-hint">
          <p>{{ tr('emptyLogsHint') }}</p>
        </li>
      </ul>
    </div>

    <!-- Toast 通知 -->
    <Transition name="toast">
      <div v-if="toastVisible" :class="['toast', toastType]">
        <span class="toast-icon">{{ toastType === 'success' ? '✅' : '❌' }}</span>
        <span class="toast-message">{{ toastMessage }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.container {
  width: 400px;
  min-height: 500px;
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header h1 {
  font-size: 20px;
  margin: 0;
}

.lang-toggle {
  padding: 6px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: var(--tab-bg, #f0f0f0);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--primary-color, #4f46e5);
  color: white;
}

.panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.search-box {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

/* 快捷清理面板 */
.quick-clean-panel {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #fff7ed, #fef3c7);
  border: 1px solid #fed7aa;
  border-radius: 10px;
}

.quick-clean-title {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  white-space: nowrap;
}

.quick-clean-buttons {
  display: flex;
  gap: 6px;
  flex: 1;
}

.btn-quick {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: linear-gradient(135deg, #f97316, #ef4444);
  color: white;
  transition: all 0.2s;
}

.btn-quick:hover:not(:disabled) {
  transform: scale(1.03);
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4);
}

.btn-quick:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-box input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  font-size: 14px;
}

.btn-primary {
  padding: 10px 16px;
  background: var(--primary-color, #4f46e5);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--action-bar-bg, #f8f8f8);
  border-radius: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-danger {
  padding: 8px 12px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #888;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 350px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.history-item:last-child {
  border-bottom: none;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-url {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

.item-meta {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #888;
}

.settings-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 16px;
  line-height: 1.5;
}

.add-rule-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.add-rule-form select {
  padding: 10px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.add-rule-form input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  font-size: 14px;
}

.rules-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 8px;
  margin-bottom: 8px;
}

.rule-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.rule-type.domain {
  background: #dbeafe;
  color: #1e40af;
}

.rule-type.keyword {
  background: #fef3c7;
  color: #92400e;
}

.rule-value {
  font-size: 14px;
}

.rule-actions {
  display: flex;
  gap: 8px;
}

.btn-toggle {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: #e5e7eb;
  color: #6b7280;
}

.btn-toggle.enabled {
  background: #d1fae5;
  color: #065f46;
}

.btn-delete {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: #fee2e2;
  color: #991b1b;
}

/* 日志面板样式 */
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--action-bar-bg, #f8f8f8);
  border-radius: 8px;
}

.logs-count {
  font-size: 13px;
  color: #666;
}

.btn-clear {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: #fee2e2;
  color: #991b1b;
  transition: opacity 0.2s;
}

.btn-clear:hover:not(:disabled) {
  opacity: 0.8;
}

.btn-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logs-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #f9fafb;
  border-left: 3px solid #94a3b8;
}

.log-item.success {
  background: #f0fdf4;
  border-left-color: #22c55e;
}

.log-item.error {
  background: #fef2f2;
  border-left-color: #ef4444;
}

.log-item.warning {
  background: #fffbeb;
  border-left-color: #f59e0b;
}

.log-item.info {
  background: #eff6ff;
  border-left-color: #3b82f6;
}

.log-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-message {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  word-break: break-word;
}

.log-details {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.log-time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

/* 清理周期分隔线 */
.cycle-divider {
  display: flex;
  align-items: center;
  padding: 12px 0;
  margin: 8px 0;
}

.cycle-divider::before,
.cycle-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, #14b8a6, transparent);
}

.cycle-label {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #0f766e;
  background: linear-gradient(135deg, #ccfbf1, #a5f3fc);
  border-radius: 20px;
  white-space: nowrap;
}

/* 下次清理倒计时样式 */
.cycle-divider.next-clean::before,
.cycle-divider.next-clean::after {
  background: linear-gradient(to right, transparent, #f59e0b, transparent);
}

.cycle-divider.next-clean .cycle-label {
  color: #92400e;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  font-variant-numeric: tabular-nums;
}

/* 空日志提示 */
.empty-hint {
  text-align: center;
  padding: 30px;
  color: #9ca3af;
  font-size: 13px;
}

/* Toast 通知样式 */
.toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  pointer-events: none;
}

.toast.success {
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.toast.error {
  background: linear-gradient(135deg, #fef2f2, #fee2e2);
  color: #991b1b;
  border: 1px solid #fecaca;
}

.toast-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.toast-message {
  white-space: nowrap;
}

/* Toast 过渡动画 */
.toast-enter-active {
  animation: toastIn 0.3s ease;
}

.toast-leave-active {
  animation: toastOut 0.3s ease;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-12px);
  }
}
</style>
