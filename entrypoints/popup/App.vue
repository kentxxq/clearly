<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import {
  searchHistory,
  deleteHistoryByUrls,
  type HistoryItem,
} from '@/utils/historyService';
import {
  getAutoCleanRules,
  addAutoCleanRule,
  removeAutoCleanRule,
  toggleAutoCleanRule,
  type CleanRule,
} from '@/utils/storageService';
import { getLogs, clearLogs, type LogEntry } from '@/utils/logService';

// 当前标签页
const activeTab = ref<'search' | 'settings' | 'logs'>('search');

// 搜索相关状态
const searchQuery = ref('');
const historyItems = ref<HistoryItem[]>([]);
const isLoading = ref(false);
const selectedUrls = ref<Set<string>>(new Set());

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
    countdown.value = '未设置';
    return;
  }
  
  const now = Date.now();
  const diff = nextCleanTime.value - now;
  
  if (diff <= 0) {
    countdown.value = '正在执行...';
    // 重新获取下次时间
    loadNextCleanTime();
    return;
  }
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  countdown.value = `${minutes}分${remainingSeconds.toString().padStart(2, '0')}秒`;
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

// 搜索历史记录
async function handleSearch() {
  if (!searchQuery.value.trim()) return;

  isLoading.value = true;
  try {
    historyItems.value = await searchHistory(searchQuery.value.trim());
    selectedUrls.value = new Set(); // 清空选择
  } catch (error) {
    console.error('搜索失败:', error);
  } finally {
    isLoading.value = false;
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
    alert(`成功删除 ${deleted} 条记录`);
  } catch (error) {
    console.error('删除失败:', error);
    alert('删除失败，请重试');
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
    alert(error.message || '添加失败');
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
function isNewCycleStart(logMessage: string): boolean {
  return logMessage.includes('自动清理完成') || logMessage.includes('没有匹配的记录需要清理');
}

// 格式化时间
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
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

onMounted(() => {
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
      <h1>✨ Clearly</h1>
    </header>

    <!-- 标签页切换 -->
    <nav class="tabs">
      <button
        :class="['tab-btn', { active: activeTab === 'search' }]"
        @click="activeTab = 'search'"
      >
        🔍 搜索
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'settings' }]"
        @click="activeTab = 'settings'"
      >
        ⚙️ 规则
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'logs' }]"
        @click="activeTab = 'logs'; loadLogs()"
      >
        📋 日志
      </button>
    </nav>

    <!-- 搜索清理面板 -->
    <div v-if="activeTab === 'search'" class="panel">
      <!-- 搜索框 -->
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="输入域名或关键词搜索..."
          @keyup.enter="handleSearch"
        />
        <button class="btn-primary" @click="handleSearch" :disabled="isLoading">
          搜索
        </button>
      </div>

      <!-- 操作栏 -->
      <div v-if="historyItems.length > 0" class="action-bar">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
          />
          全选 ({{ selectedUrls.size }}/{{ historyItems.length }})
        </label>
        <button
          class="btn-danger"
          @click="deleteSelected"
          :disabled="selectedUrls.size === 0 || isLoading"
        >
          🗑️ 删除选中 ({{ selectedUrls.size }})
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading">加载中...</div>

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
              {{ formatTime(item.lastVisitTime) }} · 访问 {{ item.visitCount }} 次
            </div>
          </div>
        </li>
      </ul>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <p>输入关键词搜索浏览历史</p>
      </div>
    </div>

    <!-- 自动清理设置面板 -->
    <div v-if="activeTab === 'settings'" class="panel">
      <p class="settings-desc">
        添加域名或关键词规则，插件将每 1 分钟自动清理匹配的历史记录。
      </p>

      <!-- 添加规则表单 -->
      <div class="add-rule-form">
        <select v-model="newRuleType">
          <option value="domain">域名</option>
          <option value="keyword">关键词</option>
        </select>
        <input
          v-model="newRuleValue"
          type="text"
          :placeholder="newRuleType === 'domain' ? '例如: example.com' : '例如: 购物'"
          @keyup.enter="handleAddRule"
        />
        <button class="btn-primary" @click="handleAddRule">添加</button>
      </div>

      <!-- 规则列表 -->
      <ul v-if="rules.length > 0" class="rules-list">
        <li v-for="rule in rules" :key="rule.id" class="rule-item">
          <div class="rule-info">
            <span :class="['rule-type', rule.type]">
              {{ rule.type === 'domain' ? '域名' : '关键词' }}
            </span>
            <span class="rule-value">{{ rule.value }}</span>
          </div>
          <div class="rule-actions">
            <button
              :class="['btn-toggle', { enabled: rule.enabled }]"
              @click="handleToggleRule(rule.id)"
            >
              {{ rule.enabled ? '已启用' : '已禁用' }}
            </button>
            <button class="btn-delete" @click="handleRemoveRule(rule.id)">
              删除
            </button>
          </div>
        </li>
      </ul>

      <!-- 空规则状态 -->
      <div v-else class="empty-state">
        <p>暂无自动清理规则</p>
      </div>
    </div>

    <!-- 日志面板 -->
    <div v-if="activeTab === 'logs'" class="panel">
      <!-- 日志操作栏 -->
      <div class="logs-header">
        <span class="logs-count">共 {{ logs.length }} 条日志</span>
        <button class="btn-clear" @click="handleClearLogs" :disabled="logs.length === 0">
          🗑️ 清空日志
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoadingLogs" class="loading">加载中...</div>

      <!-- 日志列表 -->
      <ul v-else class="logs-list">
        <!-- 下次清理倒计时（始终显示在最上方） -->
        <li class="cycle-divider next-clean">
          <span class="cycle-label">⏱️ 下次清理 · {{ countdown }}</span>
        </li>
        
        <template v-for="(log, index) in logs" :key="log.id">
          <!-- 清理周期分隔线 -->
          <li v-if="isNewCycleStart(log.message)" class="cycle-divider">
            <span class="cycle-label">🔄 清理周期 · {{ formatTime(log.timestamp) }}</span>
          </li>
          <!-- 日志项 -->
          <li :class="['log-item', log.type]">
            <div class="log-icon">{{ getLogIcon(log.type) }}</div>
            <div class="log-content">
              <div class="log-message">{{ log.message }}</div>
              <div v-if="log.details" class="log-details">{{ log.details }}</div>
              <div class="log-time">{{ formatTime(log.timestamp) }}</div>
            </div>
          </li>
        </template>
        
        <!-- 空日志提示 -->
        <li v-if="logs.length === 0" class="empty-hint">
          <p>暂无运行日志</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.container {
  width: 400px;
  min-height: 500px;
  padding: 16px;
}

.header {
  margin-bottom: 16px;
}

.header h1 {
  font-size: 20px;
  margin: 0;
  text-align: center;
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
</style>
