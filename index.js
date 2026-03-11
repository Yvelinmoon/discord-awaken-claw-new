/**
 * 龙虾宝宝觉醒 Skill - OpenClaw 入口
 * 
 * 这个文件是 OpenClaw 主 agent 调用觉醒流程的入口
 * 
 * 使用方式：
 * 1. 在 Discord 中输入 "/awakening" 或 "开始觉醒"
 * 2. OpenClaw 检测到关键词，调用此模块
 * 3. 觉醒流程开始
 */

const awakening = require('./awakening-skill.js');

// ─── Command Detection ────────────────────────────────────────────────
/**
 * 检测消息是否是觉醒命令
 */
function isAwakeningCommand(content) {
  if (!content) return false;
  
  const normalized = content.trim().toLowerCase();
  
  // 命令形式
  if (normalized === '/awakening' || normalized === '/awaken') {
    return true;
  }
  
  // 关键词形式
  const keywords = ['开始觉醒', '觉醒', '龙虾宝宝', '虾宝'];
  return keywords.some(kw => normalized.includes(kw));
}

/**
 * 检测是否是按钮交互
 */
function isButtonInteraction(customId) {
  if (!customId) return false;
  
  const prefixes = ['start_', 'answer_', 'manual_', 'confirm_yes_', 'confirm_no_'];
  return prefixes.some(prefix => customId.startsWith(prefix));
}

/**
 * 从按钮 ID 中提取用户 ID
 */
function extractUserIdFromButton(customId) {
  const parts = customId.split('_');
  // 格式：action_userId 或 action_userId_index
  // 找到倒数第二个或最后一个部分作为 userId
  
  // 尝试从后往前找数字（用户 ID）
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) {
      return parts[i];
    }
  }
  
  return null;
}

// ─── Main Handler ─────────────────────────────────────────────────────
/**
 * 处理 Discord 消息
 * 
 * @param {Object} context - 消息上下文
 * @param {string} context.userId - 用户 ID
 * @param {string} context.channelId - 频道 ID
 * @param {string} context.guildId - 服务器 ID（用于更新昵称和头像）⭐
 * @param {string} context.content - 消息内容
 * @param {string} context.customId - 按钮交互的 customId（如果有）
 * @param {Function} context.sendMessage - 发送消息的函数
 * @param {string} context.interactionType - 交互类型：'message' | 'button'
 */
async function handleDiscordMessage(context) {
  const {
    userId,
    channelId,
    guildId,
    content,
    customId,
    sendMessage,
    interactionType = 'message',
  } = context;
  
  try {
    // 按钮交互
    if (interactionType === 'button' && customId) {
      if (!isButtonInteraction(customId)) {
        return false; // 不是觉醒相关的按钮
      }
      
      const buttonUserId = extractUserIdFromButton(customId);
      if (buttonUserId !== userId) {
        await sendMessage({
          message: '⚠ 这个按钮不属于你，请使用 `/awakening` 开始自己的觉醒。',
        });
        return true;
      }
      
      await awakening.handleButtonInteraction(userId, channelId, guildId, customId, sendMessage);
      return true;
    }
    
    // 普通消息
    if (interactionType === 'message') {
      const game = awakening.getGame(userId);
      
      // 觉醒命令 - 强制重置并开始新流程（方案 A）
      if (isAwakeningCommand(content)) {
        // 清除旧状态，强制重新开始
        if (game) {
          const state = require('./awakening-skill.js').loadState();
          delete state[userId];
          require('./awakening-skill.js').saveState(state);
        }
        await awakening.startAwakening(userId, channelId, guildId, sendMessage);
        return true;
      }
      
      // 觉醒后的对话 - 支持跨频道（方案 C：自动更新 channelId）
      if (game?.awakened) {
        const handled = await awakening.handleAwakenedChat(userId, channelId, guildId, content, sendMessage);
        return handled;
      }
      
      // 游戏中的消息（等待用户输入初始词或手动描述）
      if (game?.started && !game.word) {
        // 等待初始词 - 用户可能直接输入描述
        const word = content.trim().slice(0, 20);
        await awakening.handleInitialWord(userId, word, sendMessage);
        return true;
      }

      if (game?.currentQuestion && !game.currentOptions?.includes(content)) {
        // 用户手动输入描述
        const manualAnswer = content.trim().slice(0, 200);
        game.answers.push({ q: game.currentQuestion, a: manualAnswer });
        awakening.setGame(userId, game);
        
        await sendMessage({
          message: `「${manualAnswer}」`,
        });
        
        await require('./awakening-skill.js').processNextStep(userId, sendMessage);
        return true;
      }
    }
    
    return false; // 未处理
  } catch (err) {
    console.error('[Awakening] 处理消息失败:', err.message);
    await sendMessage({
      message: `⚠ 错误：${err.message}`,
    });
    return true;
  }
}

// ─── Reset Command ────────────────────────────────────────────────────
/**
 * 处理 /reset 命令
 */
async function handleResetCommand(userId, sendMessage) {
  const game = awakening.getGame(userId);
  
  if (game) {
    const state = require('./awakening-skill.js').loadState();
    delete state[userId];
    require('./awakening-skill.js').saveState(state);
  }
  
  awakening.resetSoulMD();
  
  await sendMessage({
    message: `✅ 已重置

- 游戏状态已清除
- SOUL.md 已恢复原始状态

使用 \`/awakening\` 开始新的觉醒。`,
  });
  
  return true;
}

// ─── Exports ──────────────────────────────────────────────────────────
module.exports = {
  isAwakeningCommand,
  isButtonInteraction,
  handleDiscordMessage,
  handleResetCommand,
  awakening,
};
