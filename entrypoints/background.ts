import { getEnabledRules } from '@/utils/storageService';
import { deleteHistoryByDomain, deleteHistoryByKeyword } from '@/utils/historyService';
import { log } from '@/utils/logService';

// 定时器名称
const ALARM_NAME = 'auto-clean-history';
// 清理间隔（分钟）- Chrome alarms API 最低允许 1 分钟
const CLEAN_INTERVAL_MINUTES = 1;

// 执行自动清理
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

    for (const rule of rules) {
      console.log(`[Clearly] 正在处理规则: ${rule.type} - "${rule.value}"`);
      let deleted = 0;
      if (rule.type === 'domain') {
        deleted = await deleteHistoryByDomain(rule.value);
      } else if (rule.type === 'keyword') {
        deleted = await deleteHistoryByKeyword(rule.value);
      }
      totalDeleted += deleted;
      console.log(`[Clearly] 规则 "${rule.value}" 清理了 ${deleted} 条记录`);
      if (deleted > 0) {
        await log.success(
          'logRuleClean',
          { value: rule.value, count: deleted },
          rule.type === 'domain' ? 'typeDomain' : 'typeKeyword'
        );
      }
    }

    console.log(`[Clearly] 自动清理完成，共清理 ${totalDeleted} 条记录`);
    if (totalDeleted > 0) {
      await log.success('logCleanDone', { count: totalDeleted });
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

    // 重新设置定时器
    setupAlarm();

    // 延迟 2 秒执行一次清理，确保存储已初始化
    setTimeout(() => {
      console.log('[Clearly] 安装后立即执行一次清理...');
      log.info('logInstallClean');
      executeAutoClean();
    }, 2000);
  });
});
