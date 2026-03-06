import { getEnabledRules } from '@/utils/storageService';
import { addAutoCleanRule } from '@/utils/storageService';
import {
  deleteHistoryByDomain,
  deleteHistoryByKeyword,
  deleteHistoryItem,
  eraseDownloadsByDomain,
  eraseDownloadsByKeyword,
  urlMatchesDomain,
  urlMatchesKeyword,
} from '@/utils/historyService';
import { log } from '@/utils/logService';
import { getStoredLanguage, tWithLang } from '@/utils/i18n';

// 定时器名称
const ALARM_NAME = 'auto-clean-history';
// 清理间隔（分钟）- Chrome alarms API 最低允许 1 分钟
const CLEAN_INTERVAL_MINUTES = 1;
// 右键菜单 ID
const CONTEXT_MENU_ID = 'clearly-add-domain';

// ===== 功能 1：实时监听秒删 =====
// 当浏览器新增一条访问记录时，立即检查是否命中规则并删除
async function handleVisited(result: Browser.history.HistoryItem) {
  const url = result.url || '';
  const title = result.title || '';
  if (!url) return;

  try {
    const rules = await getEnabledRules();
    for (const rule of rules) {
      let matched = false;
      if (rule.type === 'domain') {
        matched = urlMatchesDomain(url, rule.value);
      } else if (rule.type === 'keyword') {
        matched = urlMatchesKeyword(url, title, rule.value);
      }

      if (matched) {
        // 立即删除该条历史记录
        await deleteHistoryItem(url);
        console.log(`[Clearly] 实时拦截: "${rule.value}" 命中 URL: ${url}`);
        await log.success('logRealtimeHit', { value: rule.value }, 'logRealtimeUrl', { url });
        return; // 一条记录只需要匹配一次
      }
    }
  } catch (error) {
    console.error('[Clearly] 实时监听处理失败:', error);
  }
}

// ===== 功能 2：右键菜单快捷添加规则（支持 i18n） =====
// 初始化右键菜单，读取用户语言偏好设置标题
async function setupContextMenu() {
  // 清除旧菜单以防重复
  browser.contextMenus.removeAll();

  // 从 storage 读取用户的语言偏好
  const lang = await getStoredLanguage();
  const title = tWithLang(lang, 'contextMenuAddDomain');

  browser.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title,
    contexts: ['page'],
  });
}

// 当用户切换语言时，动态更新右键菜单标题
async function updateContextMenuTitle() {
  const lang = await getStoredLanguage();
  const title = tWithLang(lang, 'contextMenuAddDomain');
  browser.contextMenus.update(CONTEXT_MENU_ID, { title });
}

// 处理右键菜单点击
async function handleContextMenuClick(
  info: Browser.contextMenus.OnClickData,
  tab?: Browser.tabs.Tab
) {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  // 从当前页面的 URL 中提取域名
  const pageUrl = info.pageUrl || tab?.url;
  if (!pageUrl) return;

  try {
    const parsed = new URL(pageUrl);
    const domain = parsed.hostname;
    if (!domain) return;

    // 尝试添加规则
    try {
      await addAutoCleanRule('domain', domain);
      console.log(`[Clearly] 右键菜单添加规则: ${domain}`);
      await log.success('logContextMenuAdded', undefined, 'logContextMenuDomain', { domain });

      // 添加成功后立即删除当前页面的历史记录
      await deleteHistoryByDomain(domain);
    } catch (e: any) {
      // 规则已存在，属于正常情况
      console.log(`[Clearly] 右键菜单: 规则已存在 - ${domain}`);
      await log.info('logContextMenuExists', { domain });
    }
  } catch (error) {
    console.error('[Clearly] 右键菜单处理失败:', error);
  }
}

// ===== 功能 3（集成）：执行自动清理，同时清理历史记录和下载记录 =====
async function executeAutoClean() {
  const now = new Date().toLocaleString();
  console.log('[Clearly] 开始执行自动清理...', now);
  await log.info('logStartClean', { time: now });

  try {
    const rules = await getEnabledRules();
    console.log('[Clearly] 获取到规则数量:', rules.length);
    await log.info('logGotRules', { count: rules.length });

    if (rules.length === 0) {
      console.log('[Clearly] 没有启用的规则，跳过清理');
      await log.info('logNoRules');
      return;
    }

    let totalDeleted = 0;
    let totalDownloadsErased = 0;

    for (const rule of rules) {
      console.log(`[Clearly] 正在处理规则: ${rule.type} - "${rule.value}"`);
      let deleted = 0;
      let downloadsErased = 0;

      if (rule.type === 'domain') {
        deleted = await deleteHistoryByDomain(rule.value);
        // 功能 3：同时清理下载记录
        downloadsErased = await eraseDownloadsByDomain(rule.value);
      } else if (rule.type === 'keyword') {
        deleted = await deleteHistoryByKeyword(rule.value);
        // 功能 3：同时清理下载记录
        downloadsErased = await eraseDownloadsByKeyword(rule.value);
      }

      totalDeleted += deleted;
      totalDownloadsErased += downloadsErased;

      console.log(`[Clearly] 规则 "${rule.value}" 清理了 ${deleted} 条历史, ${downloadsErased} 条下载`);
      if (deleted > 0) {
        await log.success(
          'logRuleClean',
          { value: rule.value, count: deleted },
          rule.type === 'domain' ? 'typeDomain' : 'typeKeyword'
        );
      }
    }

    // 记录下载清理日志
    if (totalDownloadsErased > 0) {
      await log.success('logDownloadClean', { count: totalDownloadsErased });
    }

    console.log(`[Clearly] 自动清理完成，共清理 ${totalDeleted} 条历史, ${totalDownloadsErased} 条下载`);
    if (totalDeleted > 0 || totalDownloadsErased > 0) {
      await log.success('logCleanDone', { count: totalDeleted + totalDownloadsErased });
    } else {
      await log.info('logNoMatch');
    }
  } catch (error) {
    console.error('[Clearly] 自动清理失败:', error);
    await log.error('logCleanFailed', { error: String(error) });
  }
}

// 设置定时器
async function setupAlarm() {
  // 先清除已有的定时器，避免重复
  await browser.alarms.clear(ALARM_NAME);

  // 创建新的定时器
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: CLEAN_INTERVAL_MINUTES,
    periodInMinutes: CLEAN_INTERVAL_MINUTES,
  });

  console.log(`[Clearly] 定时器已设置，每 ${CLEAN_INTERVAL_MINUTES} 分钟执行一次清理`);
  await log.info('logAlarmSet', { interval: CLEAN_INTERVAL_MINUTES });

  // 验证定时器是否创建成功
  const alarm = await browser.alarms.get(ALARM_NAME);
  if (alarm) {
    const nextTime = new Date(alarm.scheduledTime).toLocaleString();
    console.log('[Clearly] 定时器确认创建成功:', {
      name: alarm.name,
      scheduledTime: nextTime,
      periodInMinutes: alarm.periodInMinutes,
    });
    await log.success('logAlarmSuccess', undefined, 'logNextTime', { time: nextTime });
  } else {
    console.error('[Clearly] 定时器创建失败！');
    await log.error('logAlarmFailed');
  }
}

export default defineBackground(() => {
  // 重要：MV3 Service Worker 要求事件监听器必须同步注册！
  // 不能在 async 函数中注册，否则 Service Worker 重启时可能错过事件

  const now = new Date().toLocaleString();
  console.log('[Clearly] 后台脚本已启动', now);

  // 异步日志记录不阻塞主流程
  log.info('logBgStarted', { time: now });

  // 设置定时器（不等待完成）
  setupAlarm();

  // ===== 功能 1：注册实时监听 =====
  browser.history.onVisited.addListener(handleVisited);

  // ===== 功能 2：注册右键菜单 =====
  setupContextMenu();
  browser.contextMenus.onClicked.addListener(handleContextMenuClick);

  // 监听 storage 变化，当用户切换语言时更新右键菜单标题
  browser.storage.onChanged.addListener((changes) => {
    if ('clearly_language' in changes) {
      updateContextMenuTitle();
    }
  });

  // 监听定时器事件 - 必须同步注册！
  browser.alarms.onAlarm.addListener((alarm) => {
    console.log('[Clearly] 收到定时器事件:', alarm.name, new Date().toLocaleString());
    if (alarm.name === ALARM_NAME) {
      executeAutoClean();
    }
  });

  // 扩展安装或更新时 - 必须同步注册！
  browser.runtime.onInstalled.addListener((details) => {
    console.log('[Clearly] 扩展已安装/更新', details.reason);
    log.info('logInstalled', undefined, 'logReason', { reason: details.reason });

    // 重新设置定时器和右键菜单
    setupAlarm();
    setupContextMenu();

    // 延迟 2 秒执行一次清理，确保存储已初始化
    setTimeout(() => {
      console.log('[Clearly] 安装后立即执行一次清理...');
      log.info('logInstallClean');
      executeAutoClean();
    }, 2000);
  });
});
