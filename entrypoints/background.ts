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
  await log.info('开始执行自动清理', now);

  try {
    const rules = await getEnabledRules();
    console.log('[Clearly] 获取到规则数量:', rules.length);
    await log.info(`获取到 ${rules.length} 条启用的规则`);

    if (rules.length === 0) {
      console.log('[Clearly] 没有启用的规则，跳过清理');
      await log.info('没有启用的规则，跳过清理');
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
        await log.success(`规则 "${rule.value}" 清理了 ${deleted} 条记录`, `类型: ${rule.type === 'domain' ? '域名' : '关键词'}`);
      }
    }

    console.log(`[Clearly] 自动清理完成，共清理 ${totalDeleted} 条记录`);
    if (totalDeleted > 0) {
      await log.success(`自动清理完成，共清理 ${totalDeleted} 条记录`);
    } else {
      await log.info('自动清理完成，没有匹配的记录需要清理');
    }
  } catch (error) {
    console.error('[Clearly] 自动清理失败:', error);
    await log.error('自动清理失败', String(error));
  }
}

// 设置定时器
async function setupAlarm() {
  // 先清除已有的定时器，避免重复
  await browser.alarms.clear(ALARM_NAME);

  // 创建新的定时器
  // delayInMinutes: 第一次触发的延迟时间（分钟）
  // periodInMinutes: 之后每次触发的间隔（分钟）
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: CLEAN_INTERVAL_MINUTES,
    periodInMinutes: CLEAN_INTERVAL_MINUTES,
  });

  console.log(`[Clearly] 定时器已设置，每 ${CLEAN_INTERVAL_MINUTES} 分钟执行一次清理`);
  await log.info(`定时器已设置，每 ${CLEAN_INTERVAL_MINUTES} 分钟执行一次清理`);

  // 验证定时器是否创建成功
  const alarm = await browser.alarms.get(ALARM_NAME);
  if (alarm) {
    const info = `下次执行时间: ${new Date(alarm.scheduledTime).toLocaleString()}`;
    console.log('[Clearly] 定时器确认创建成功:', {
      name: alarm.name,
      scheduledTime: new Date(alarm.scheduledTime).toLocaleString(),
      periodInMinutes: alarm.periodInMinutes,
    });
    await log.success('定时器创建成功', info);
  } else {
    console.error('[Clearly] 定时器创建失败！');
    await log.error('定时器创建失败');
  }
}

export default defineBackground(() => {
  const now = new Date().toLocaleString();
  console.log('[Clearly] 后台脚本已启动', now);
  log.info('后台脚本已启动', now);

  // 设置定时器
  setupAlarm();

  // 监听定时器事件
  browser.alarms.onAlarm.addListener((alarm) => {
    console.log('[Clearly] 收到定时器事件:', alarm.name, new Date().toLocaleString());
    if (alarm.name === ALARM_NAME) {
      executeAutoClean();
    }
  });

  // 扩展安装或更新时
  browser.runtime.onInstalled.addListener((details) => {
    console.log('[Clearly] 扩展已安装/更新', details.reason);
    log.info('扩展已安装/更新', `原因: ${details.reason}`);

    // 重新设置定时器
    setupAlarm();

    // 延迟 2 秒执行一次清理，确保存储已初始化
    setTimeout(() => {
      console.log('[Clearly] 安装后立即执行一次清理...');
      log.info('安装后立即执行一次清理');
      executeAutoClean();
    }, 2000);
  });
});
