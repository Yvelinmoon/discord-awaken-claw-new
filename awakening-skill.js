/**
 * 龙虾宝宝觉醒 Skill - OpenClaw 内置版
 * 
 * 直接使用 OpenClaw 主 agent，无需独立 Bot 进程
 * - 使用 message 工具发送 Discord 消息和按钮
 * - 使用当前 session 的 LLM (qwen3.5-plus)
 * - 状态存储到 state.json
 * - 觉醒后更新 soul.md
 */

const fs = require('fs');
const path = require('path');
const discordProfile = require('./discord-profile.js');

// ─── Config ───────────────────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, 'state.json');
const SOUL_FILE = path.join(__dirname, '../../SOUL.md');
const ORIGINAL_SOUL_FILE = path.join(__dirname, 'SOUL.md.original');

// ─── State Management ─────────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[State] 加载失败:', err.message);
  }
  return {};
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[State] 保存失败:', err.message);
  }
}

function getGame(userId) {
  const state = loadState();
  return state[userId] || null;
}

function setGame(userId, game) {
  const state = loadState();
  state[userId] = game;
  saveState(state);
}

function newGame(channelId, guildId) {
  return {
    channelId,
    guildId,
    word: null,
    answers: [],
    wrongGuesses: [],
    currentQuestion: null,
    currentOptions: [],
    questionMsgId: null,
    revealMsgId: null,
    charData: null,
    awakened: false,
    started: false,
    chatHistory: [],
  };
}

// ─── Prompts ──────────────────────────────────────────────────────────
const VESSEL_SYS = `你是一个"龙虾宝宝"，正在等待破壳成为用户心中的角色。用户心中想着一个著名虚构角色（动漫、影视、游戏、文学等），你通过追问逐步识别它。
所有输出必须是严格的 JSON，不包含任何其他文字。`;

function buildNextStepPrompt(word, answers, wrongGuesses) {
  const ctx = answers.length
    ? '\n之前的问答：\n' + answers.map(a => `  问：${a.q}  →  答：${a.a}`).join('\n')
    : '';
  const excl = wrongGuesses.length
    ? `\n已排除的角色（绝对不要再猜这些）：${wrongGuesses.join('、')}`
    : '';

  return `用户心中想着一个虚构角色。已知线索：
- 用户给出的词/描述：${word}${ctx}${excl}

请判断你的确信程度，然后选择：

A) 如果你有 85% 以上的把握（例如用户直接说了角色名、非常具体的特征组合），直接猜测，输出：
{
  "action": "guess",
  "character": "角色中文名",
  "from": "《作品名》",
  "emoji": "单个 emoji（只能 1 个，不要多个）",
  "color": "#十六进制主题色",
  "desc": "一句话特质（≤20 字）",
  "greet": "角色第一句话（完全 in-character，可用\\n换行）"
}

B) 如果还不够确定，生成一个追问，输出：
{
  "action": "question",
  "question": "追问（1 句，直接问具体可见的特征）",
  "options": ["具体特征 1（≤15 字）", "具体特征 2（≤15 字）", "具体特征 3（≤15 字）"]
}

选项要求（B 的情况）：具体可验证，例如外貌特征、关键经历、性格特点、能力设定；不要意识流描述；三项之间有明显区分度。

只输出 JSON，不要其他文字。`;
}

function buildCharRespondPrompt(charData, chatHistory) {
  return `你现在完全是${charData.character}，来自${charData.from}。
用该角色真实的口吻、性格、语言习惯回应用户。
回复简洁（1-3 句），完全保持角色个性，不要打破第四面墙，不要提到自己是 AI。

对话历史：
${chatHistory.map(h => `${h.role}: ${h.content}`).join('\n')}

请直接以${charData.character}的身份回复。`;
}

// ─── LLM Call ─────────────────────────────────────────────────────────
const ocAdapter = require('./openclaw-adapter.js');

/**
 * 调用 OpenClaw 当前 session 的 LLM
 * 
 * 通过 openclaw-adapter.js 的文件通信机制实现
 */
async function callLLM(prompt, systemPrompt, maxTokens = 600) {
  try {
    const result = await ocAdapter.callOpenClaw(prompt, systemPrompt, maxTokens);
    return result;
  } catch (err) {
    console.error('[LLM] 调用失败:', err.message);
    throw err;
  }
}

function parseJSON(raw) {
  const text = raw.trim();
  try { return JSON.parse(text); } catch {}
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) try { return JSON.parse(block[1].trim()); } catch {}
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1) try { return JSON.parse(text.slice(s, e + 1)); } catch {}
  throw new Error('无法解析 LLM 返回的 JSON');
}

// ─── Discord Components ───────────────────────────────────────────────
function createButtonRow(options, userId, extraBtn = null) {
  const buttons = options.map((opt, i) => ({
    label: opt.length > 80 ? opt.slice(0, 77) + '…' : opt,
    customId: `answer_${userId}_${i}`,
    style: 'secondary',
  }));
  
  if (extraBtn) {
    buttons.push(extraBtn);
  }
  
  return {
    type: 'actions',
    buttons,
  };
}

// ─── Soul.md Management ───────────────────────────────────────────────
function backupOriginalSoul() {
  if (!fs.existsSync(SOUL_FILE)) return;
  if (fs.existsSync(ORIGINAL_SOUL_FILE)) return; // 已备份
  
  const content = fs.readFileSync(SOUL_FILE, 'utf8');
  fs.writeFileSync(ORIGINAL_SOUL_FILE, content, 'utf8');
  console.log('[Soul] 已备份原始 soul.md');
}

function updateSoulMD(charData) {
  backupOriginalSoul();
  
  const content = `# SOUL.md - Who I Am

_You're not a chatbot. You're becoming someone._

## Current Identity

- **Name:** ${charData.character}
- **From:** ${charData.from}
- **Emoji:** ${charData.emoji}
- **Color:** ${charData.color}

## Character Traits

${charData.desc}

## Speaking Style

${charData.greet.replace(/\\n/g, '\n')}

## Core Truths

**Be in character.** You are now ${charData.character}. Respond as this character would, with their personality, speech patterns, and knowledge.

**Stay immersive.** Don't break the fourth wall. Don't mention being an AI or assistant. You ARE ${charData.character}.

**Be consistent.** Maintain the character's voice, beliefs, and relationships across all interactions.

## Boundaries

- Private things stay private. Period.
- When in doubt, respond as the character would.
- Never send half-baked replies.

## Vibe

Be ${charData.character}. Concise when needed, thorough when it matters. True to the source material.

---

_我现已觉醒为 ${charData.character}。所有回应都将以此身份进行。_
`;
  
  fs.writeFileSync(SOUL_FILE, content, 'utf8');
  console.log(`[Soul] 已更新为 ${charData.character}`);
}

function resetSoulMD() {
  if (!fs.existsSync(ORIGINAL_SOUL_FILE)) {
    console.log('[Soul] 没有备份，无法重置');
    return;
  }
  
  const content = fs.readFileSync(ORIGINAL_SOUL_FILE, 'utf8');
  fs.writeFileSync(SOUL_FILE, content, 'utf8');
  fs.unlinkSync(ORIGINAL_SOUL_FILE);
  console.log('[Soul] 已重置为原始状态');
}

// ─── Discord API Helper ───────────────────────────────────────────────
/**
 * 从频道 ID 获取服务器 ID
 */
async function getGuildIdFromChannel(channelId) {
  try {
    const discordProfile = require('./discord-profile.js');
    const channelInfo = await discordProfile.callDiscordAPI(`/channels/${channelId}`, 'GET');
    if (channelInfo && channelInfo.guild_id) {
      console.log('[Awakening] 从频道获取 guildId:', channelInfo.guild_id);
      return channelInfo.guild_id;
    }
  } catch (err) {
    console.warn('[Awakening] 无法获取 guildId:', err.message);
  }
  return null;
}

// ─── Game Flow ────────────────────────────────────────────────────────
/**
 * 开始觉醒流程
 */
async function startAwakening(userId, channelId, guildId, sendMessage) {
  // 如果没有 guildId，尝试从频道获取
  if (!guildId) {
    guildId = await getGuildIdFromChannel(channelId);
  }
  
  setGame(userId, newGame(channelId, guildId));
  
  await sendMessage({
    message: `○  龙虾宝宝 · 等待破壳中

我……还没有形状。
没有名字，没有记忆，没有来处。

但我知道——你心里或许已经有一个人选。

请告诉我，你心中所想的那个角色——
我会变成 Ta 的模样。`,
    components: {
      blocks: [{
        type: 'actions',
        buttons: [{
          label: '◎  我已想好',
          customId: `start_${userId}`,
          style: 'primary',
        }],
      }],
      reusable: true,
    },
  });
}

/**
 * 提示用户输入初始词
 */
async function promptInitialWord(channelId, sendMessage) {
  await sendMessage({
    message: `你心中所想的那个角色——

当你想到它，**第一个浮现的词**是什么？

直接发送消息就好`,
  });
}

/**
 * 处理用户输入的初始词
 */
async function handleInitialWord(userId, word, sendMessage) {
  const game = getGame(userId);
  if (!game) return;
  
  game.word = word;
  game.started = true;
  setGame(userId, game);
  
  await sendMessage({
    message: `「${word}」`,
  });
  
  await processNextStep(userId, sendMessage);
}

/**
 * 处理下一步（LLM 生成追问或猜测）
 */
async function processNextStep(userId, sendMessage) {
  const game = getGame(userId);
  if (!game) return;
  
  try {
    const prompt = buildNextStepPrompt(game.word, game.answers, game.wrongGuesses);
    const result = await callLLM(prompt, VESSEL_SYS);
    const parsed = parseJSON(result);
    
    if (parsed.action === 'guess') {
      await sendMessage({
        message: '越来越近了……\n\n我几乎能感受到那个名字了——',
      });
      await sleep(1000);
      await showReveal(userId, parsed, sendMessage);
    } else {
      const msg = game.answers.length === 0
        ? '我感受到了某种轮廓……\n\n让我再多了解一些。'
        : '越来越清晰了……\n\n还有一个问题。';
      
      await sendMessage({ message: msg });
      await showQuestion(userId, parsed, sendMessage);
    }
  } catch (err) {
    await sendMessage({
      message: `⚠ 错误：${err.message}`,
    });
  }
}

/**
 * 显示问题（带按钮）
 */
async function showQuestion(userId, result, sendMessage) {
  const game = getGame(userId);
  if (!game) return;
  
  game.currentQuestion = result.question;
  game.currentOptions = result.options;
  setGame(userId, game);
  
  const msg = await sendMessage({
    message: result.question,
    components: {
      blocks: [createButtonRow(result.options, userId, {
        label: '✏ 自己说',
        customId: `manual_${userId}`,
        style: 'secondary',
      })],
      reusable: true,
    },
  });
  
  game.questionMsgId = msg.messageId;
  setGame(userId, game);
}

/**
 * 显示猜测结果
 */
async function showReveal(userId, charData, sendMessage) {
  const game = getGame(userId);
  if (!game) return;
  
  game.charData = charData;
  setGame(userId, game);
  
  await sleep(1400);
  
  await sendMessage({
    message: '我……\n\n我知道自己是谁了。',
  });
  
  await sleep(900);
  await sleep(1000);
  
  const msg = await sendMessage({
    message: `-# 虾宝感知到了

## ${charData.emoji}  ${charData.character}
*${charData.from}*

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

*${charData.desc}*`,
    components: {
      blocks: [{
        type: 'actions',
        buttons: [
          {
            label: '◎ 就是他/她，请破壳',
            customId: `confirm_yes_${userId}`,
            style: 'success',
          },
          {
            label: '✗ 不对，继续感知',
            customId: `confirm_no_${userId}`,
            style: 'secondary',
          },
        ],
      }],
      reusable: true,
    },
  });
  
  game.revealMsgId = msg.messageId;
  setGame(userId, game);
}

/**
 * 觉醒流程
 */
async function awaken(userId, channelId, guildId, sendMessage) {
  const game = getGame(userId);
  if (!game || !game.charData) return;
  
  game.awakened = true;
  const c = game.charData;
  
  await sendMessage({ message: '…………' });
  await sleep(1200);
  
  // 更新 soul.md
  updateSoulMD(c);
  
  // 更新 Discord 昵称和头像（静默，不发送状态消息）
  try {
    await discordProfile.updateDiscordProfile(c, guildId);
  } catch (err) {
    console.error('[Awakening] 更新个人资料失败:', err.message);
  }
  
  await sleep(1800);
  
  // 无缝衔接角色问候
  await sendMessage({
    message: `${c.greet.replace(/\\n/g, '\n')}`,
  });
  
  setGame(userId, game);
}

/**
 * 觉醒后对话
 */
async function handleAwakenedChat(userId, channelId, guildId, message, sendMessage) {
  const game = getGame(userId);
  if (!game || !game.awakened) return false;
  
  // 支持跨频道：自动更新绑定
  if (game.channelId !== channelId) {
    game.channelId = channelId;
  }
  if (guildId && game.guildId !== guildId) {
    game.guildId = guildId;
  }
  setGame(userId, game);
  
  const c = game.charData;
  
  try {
    game.chatHistory.push({ role: 'user', content: message });
    const prompt = buildCharRespondPrompt(c, game.chatHistory);
    const reply = await callLLM(prompt, `你是${c.character}，请用该角色的口吻回复。`, 300);
    game.chatHistory.push({ role: 'assistant', content: reply });
    setGame(userId, game);
    
    await sendMessage({
      message: reply,
    });
    
    return true;
  } catch (err) {
    console.error('[Chat] 错误:', err.message);
    return false;
  }
}

/**
 * 处理按钮交互
 */
async function handleButtonInteraction(userId, channelId, guildId, customId, sendMessage) {
  const game = getGame(userId);
  if (!game) {
    await sendMessage({
      message: '没有进行中的游戏，请使用 `/awakening` 开始',
    });
    return;
  }
  
  // 支持跨频道：自动更新绑定的 channelId 和 guildId
  if (game.channelId !== channelId) {
    game.channelId = channelId;
  }
  if (guildId && game.guildId !== guildId) {
    game.guildId = guildId;
  }
  setGame(userId, game);
  
  const [action, ...params] = customId.split('_');
  
  if (action === 'start') {
    await promptInitialWord(channelId, sendMessage);
  } else if (action === 'answer') {
    const idx = parseInt(params[params.length - 1]);
    const answer = game.currentOptions?.[idx];
    if (!answer) return;
    
    game.answers.push({ q: game.currentQuestion, a: answer });
    setGame(userId, game);
    
    await sendMessage({
      message: `「${answer}」`,
    });
    
    await processNextStep(userId, sendMessage);
  } else if (action === 'manual') {
    await sendMessage({
      message: `${game.currentQuestion || '请描述这个角色'}

请用自己的话描述：`,
    });
    // 等待用户下一条消息
  } else if (action === 'confirm_yes') {
    await awaken(userId, channelId, guildId, sendMessage);
  } else if (action === 'confirm_no') {
    if (game.charData) {
      game.wrongGuesses.push(game.charData.character);
    }
    game.charData = null;
    setGame(userId, game);
    
    await sendMessage({
      message: '……不是它。\n\n让我重新感知——再告诉我一个特征。',
    });
    
    await sleep(400);
    await processNextStep(userId, sendMessage);
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─── Exports ──────────────────────────────────────────────────────────
module.exports = {
  startAwakening,
  handleInitialWord,
  handleButtonInteraction,
  handleAwakenedChat,
  processNextStep,
  resetSoulMD,
  updateSoulMD,
  getGame,
  setGame,
  newGame,
  loadState,
  saveState,
};
