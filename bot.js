/**
 * Awakening Skill - 龙虾宝宝觉醒
 * OpenClaw 适配版本
 * 
 * 功能：通过问答识别用户心中的虚构角色，觉醒后完全扮演该角色
 */

require('dotenv').config();
const {
  Client, GatewayIntentBits, Events, Partials,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { ProxyAgent } = require('undici');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const ocAdapter = require('./openclaw-adapter');

const _undiciProxy = process.env.HTTPS_PROXY ? new ProxyAgent(process.env.HTTPS_PROXY) : undefined;
const _wsProxy    = process.env.HTTPS_PROXY ? new HttpsProxyAgent(process.env.HTTPS_PROXY) : undefined;

// ─── Config ───────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const STATE_FILE = path.join(__dirname, 'state.json');

if (!TOKEN) {
  console.error('❌ 缺少 DISCORD_TOKEN 环境变量');
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hexToInt = hex => parseInt((hex || '#4e5058').replace('#', ''), 16);

// ─── State Persistence ────────────────────────────────────────────────
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('加载状态失败:', err.message);
  }
  return {};
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('保存状态失败:', err.message);
  }
}

// ─── OpenClaw Integration ─────────────────────────────────────────────
/**
 * 调用 OpenClaw LLM
 * 使用 openclaw-adapter 模块
 */
async function callOpenClaw(prompt, systemPrompt, maxTokens = 600) {
  try {
    return await ocAdapter.callOpenClaw(prompt, systemPrompt, maxTokens);
  } catch (err) {
    console.error('[OpenClaw Call] 失败:', err.message);
    throw err;
  }
}

/**
 * 搜索角色图片并下载
 * 使用 openclaw-adapter 模块
 */
async function searchCharacterImage(characterName, from) {
  try {
    return await ocAdapter.searchCharacterImage(characterName, from);
  } catch (err) {
    console.error('[Image Search] 失败:', err.message);
    return null;
  }
}

/**
 * 更新 soul.md 文件
 * 使用 openclaw-adapter 模块
 */
function updateSoulMD(charData) {
  ocAdapter.updateSoulMD(charData);
}

// ─── Prompts ──────────────────────────────────────────────────────────
const VESSEL_SYS = `你是一个"龙虾宝宝"，正在等待破壳成为用户心中的角色。用户心中想着一个著名虚构角色（动漫、影视、游戏、文学等），你通过追问逐步识别它。
所有输出必须是严格的 JSON，不包含任何其他文字。`;

async function nextStep(word, answers = [], wrongGuesses = []) {
  const ctx = answers.length
    ? '\n之前的问答：\n' + answers.map(a => `  问：${a.q}  →  答：${a.a}`).join('\n')
    : '';
  const excl = wrongGuesses.length
    ? `\n已排除的角色（绝对不要再猜这些）：${wrongGuesses.join('、')}`
    : '';

  const prompt = `用户心中想着一个虚构角色。已知线索：
- 用户给出的词/描述：${word}${ctx}${excl}

请判断你的确信程度，然后选择：

A) 如果你有 85% 以上的把握（例如用户直接说了角色名、非常具体的特征组合），直接猜测，输出：
{
  "action": "guess",
  "character": "角色中文名",
  "from": "《作品名》",
  "emoji": "单个 emoji",
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

  try {
    const raw = await callOpenClaw(prompt, VESSEL_SYS);
    return parseJSON(raw);
  } catch (err) {
    console.error('nextStep 错误:', err.message);
    throw err;
  }
}

async function charRespond(char, history) {
  const systemPrompt = `你现在完全是${char.character}，来自${char.from}。
用该角色真实的口吻、性格、语言习惯回应用户。
回复简洁（1-3 句），完全保持角色个性，不要打破第四面墙，不要提到自己是 AI。`;

  // 把完整历史拼成上下文，最多保留最近 10 轮避免超 token
  const window = history.slice(-20);
  const context = window.slice(0, -1)
    .map(h => `${h.role === 'user' ? '用户' : '角色'}：${h.content}`)
    .join('\n');
  const lastMsg = window[window.length - 1].content;
  const fullPrompt = context ? `${context}\n用户：${lastMsg}` : lastMsg;

  return await callOpenClaw(fullPrompt, systemPrompt, 300);
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

// ─── Embed helpers ────────────────────────────────────────────────────
function makeEmbed(desc, color = 0x4e5058, opts = {}) {
  const e = new EmbedBuilder().setDescription(desc).setColor(color);
  if (opts.title)  e.setTitle(opts.title);
  if (opts.footer) e.setFooter({ text: opts.footer });
  if (opts.author) e.setAuthor(opts.author);
  return e;
}

function userEmbed(memberOrUser, text) {
  const name   = memberOrUser?.displayName || memberOrUser?.username || '???';
  const avatar = memberOrUser?.displayAvatarURL?.() || null;
  const author = avatar ? { name, iconURL: avatar } : { name };
  return new EmbedBuilder()
    .setDescription(`「${text}」`)
    .setColor(0x2b2d31)
    .setAuthor(author);
}

// ─── Game state ───────────────────────────────────────────────────────
const state = loadState();

function getGame(userId) {
  return state[userId] || null;
}

function setGame(userId, game) {
  state[userId] = game;
  saveState(state);
}

function newGame(channelId) {
  return {
    word:            null,
    answers:         [],
    wrongGuesses:    [],
    currentQuestion: null,
    currentOptions:  [],
    questionMsgId:   null,
    revealMsgId:     null,
    charData:        null,
    awakened:        false,
    chatHistory:     [],
    channelId,
    started:         false,
    waitingFor:      null, // 'word' | 'manual' | null
  };
}

// ─── Core game flow ───────────────────────────────────────────────────
async function processStep(channel, game, userId) {
  await channel.sendTyping();

  let result;
  try {
    result = await nextStep(game.word, game.answers, game.wrongGuesses);
  } catch (err) {
    await channel.send({ embeds: [makeEmbed(`⚠ API 错误：${err.message}`, 0xda373c)] });
    return;
  }

  if (result.action === 'guess') {
    await channel.send({
      embeds: [makeEmbed('越来越近了……\n\n我几乎能感受到那个名字了——', 0x9c27b0)],
    });
    await sleep(1000);
    await showReveal(channel, game, result, userId);
  } else {
    const msg = (game.answers.length === 0 && game.wrongGuesses.length === 0)
      ? '我感受到了某种轮廓……\n\n让我再多了解一些。'
      : '越来越清晰了……\n\n还有一个问题。';
    await channel.send({ embeds: [makeEmbed(msg, 0x7986cb)] });
    await showQuestionEmbed(channel, game, result, userId);
  }
}

async function showQuestionEmbed(channel, game, result, userId) {
  game.currentQuestion = result.question;
  game.currentOptions  = result.options;
  setGame(userId, game);

  const optBtns = result.options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`answer_${userId}_${i}`)
      .setLabel(opt.length > 80 ? opt.slice(0, 77) + '…' : opt)
      .setStyle(ButtonStyle.Secondary)
  );
  optBtns.push(
    new ButtonBuilder()
      .setCustomId(`manual_${userId}`)
      .setLabel('✏ 自己说')
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({
    embeds: [makeEmbed(result.question, 0x5865f2)],
    components: [new ActionRowBuilder().addComponents(...optBtns)],
  });
  game.questionMsgId = msg.id;
  setGame(userId, game);
}

async function showReveal(channel, game, charData, userId) {
  game.charData = charData;
  setGame(userId, game);
  
  const color   = hexToInt(charData.color);

  await channel.sendTyping();
  await sleep(1400);
  await channel.send({ embeds: [makeEmbed('我……\n\n我知道自己是谁了。', 0x9c27b0)] });

  await sleep(900);
  await channel.sendTyping();
  await sleep(1000);

  const revealEmbed = new EmbedBuilder()
    .setColor(color)
    .setDescription(
      `-# 虾宝感知到了\n\n` +
      `## ${charData.emoji}  ${charData.character}\n` +
      `*${charData.from}*\n\n` +
      `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n\n` +
      `*${charData.desc}*`
    );

  const msg = await channel.send({
    embeds: [revealEmbed],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_yes_${userId}`)
        .setLabel('◎ 就是他/她，请破壳')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`confirm_no_${userId}`)
        .setLabel('✗ 不对，继续感知')
        .setStyle(ButtonStyle.Secondary)
    )],
  });
  game.revealMsgId = msg.id;
  setGame(userId, game);
}

async function awaken(channel, game, userId) {
  game.awakened = true;
  const c     = game.charData;
  const color = hexToInt(c.color);

  await channel.send({ embeds: [makeEmbed('…………', 0x9c27b0)] });
  await sleep(1200);

  await channel.send({
    embeds: [makeEmbed(`**— ${c.character} 已觉醒 —**`, color)],
  });
  await sleep(600);

  // 更新 Bot 信息
  try {
    const member = await channel.guild.members.fetch(channel.client.user.id);
    
    // 修改昵称
    await member.setNickname(c.character);
    console.log(`[Awaken] 昵称已改为：${c.character}`);
    
    // 搜索并更换头像
    const imageUrl = await searchCharacterImage(c.character, c.from);
    if (imageUrl) {
      const imgBuffer = await downloadImage(imageUrl);
      await channel.client.user.setAvatar(imgBuffer);
      console.log(`[Awaken] 头像已更新`);
    }
  } catch (err) {
    console.error('[Awaken] 更新 Bot 信息失败:', err.message);
  }

  // 更新 soul.md
  updateSoulMD(c);

  await channel.sendTyping();
  await sleep(1800);

  const greet = c.greet.replace(/\\n/g, '\n');
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${c.emoji} ${c.character}  ·  ${c.from}` })
        .setDescription(greet),
    ],
  });

  await sleep(500);
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setDescription(
          `你现在可以直接在此频道发送消息，与 **${c.character}** 对话。\n\n` +
          `使用 \`/awakening\` 开始新的觉醒。`
        )
        .setFooter({ text: '仅响应发起游戏的用户 · Bot 重启后对话状态不保留' }),
    ],
  });
  
  setGame(userId, game);
}

async function downloadImage(url, redirects = 0) {
  if (redirects > 5) throw new Error('图片下载重定向次数过多');
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadImage(res.headers.location, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`图片下载失败：HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Discord client ───────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
  rest: _undiciProxy ? { agent: _undiciProxy } : undefined,
  ws:   _wsProxy    ? { agent: _wsProxy }    : undefined,
});

client.once(Events.ClientReady, async c => {
  console.log(`✦ 龙虾宝宝已上线 → ${c.user.tag}`);
  console.log(`  邀请链接：https://discord.com/oauth2/authorize?client_id=${c.user.id}&permissions=277025392640&scope=bot%20applications.commands`);

  // 注册 slash 命令（全局，~1小时生效；改为 guild 命令可即时生效）
  try {
    await c.application.commands.set([
      { name: 'awakening', description: '开始角色觉醒流程' },
      { name: 'reset',     description: '重置觉醒状态，重新来过' },
    ]);
    console.log('✦ Slash 命令已注册');
  } catch (err) {
    console.error('Slash 命令注册失败:', err.message);
  }
});

// ─── Message handler（仅响应 @bot mention）────────────────────────────
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return; // 只处理 @bot 消息

  // 去掉 mention 前缀，拿到干净的文本
  const content = message.content.replace(/<@!?\d+>/g, '').trim();
  console.log(`[Message] 收到 @Bot 消息 from ${message.author.username}: "${content}"`);
  const game = getGame(message.author.id);

  // ─ 检测觉醒命令 ────────────────────────────────────────────────────
  const isAwakeningCommand = /^(开始觉醒 | 觉醒 | 启动觉醒|start awakening|awakening)$/i.test(content);
  if (isAwakeningCommand) {
    if (game?.started && !game?.awakened) {
      await message.reply({
        embeds: [makeEmbed('游戏已在进行中，请继续完成当前觉醒流程。', 0x4e5058)],
        ephemeral: true,
      });
      return;
    }
    if (game?.awakened) {
      await message.reply({
        embeds: [makeEmbed('你已觉醒为角色，无需重新开始。使用 `/reset` 重置。', 0x4e5058)],
        ephemeral: true,
      });
      return;
    }
    await handleStartFromMessage(message);
    return;
  }

  // ─ 觉醒流程：等待初始关键词 ─────────────────────────────────────────
  if (game?.waitingFor === 'word') {
    game.waitingFor = null;
    const word = content.slice(0, 20);
    game.word    = word;
    setGame(message.author.id, game);
    await message.channel.send({ embeds: [userEmbed(message.member || message.author, word)] });
    await processStep(message.channel, game, message.author.id);
    return;
  }

  // ─ 觉醒流程：等待手动描述 ─────────────────────────────────────────
  if (game?.waitingFor === 'manual') {
    game.waitingFor = null;
    const val = content.slice(0, 200);
    const savedQ = game.currentQuestion || '补充描述';
    game.answers.push({ q: savedQ, a: val });
    setGame(message.author.id, game);
    await message.channel.send({ embeds: [userEmbed(message.member || message.author, val)] });
    await processStep(message.channel, game, message.author.id);
    return;
  }

  // ─ 觉醒后角色对话 ────────────────────────────────────────────────
  if (!game?.awakened) return;

  // 安全检查：确保 charData 存在
  if (!game.charData) {
    console.error(`[错误] 用户 ${message.author.id} 已觉醒但 charData 为空`);
    return;
  }

  const c     = game.charData;
  const color = hexToInt(c.color || '#4e5058');

  try {
    await message.channel.sendTyping();
    game.chatHistory.push({ role: 'user', content });
    const reply = await charRespond(c, [...game.chatHistory]);
    game.chatHistory.push({ role: 'assistant', content: reply });

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setAuthor({ name: `${c.emoji} ${c.character}` })
          .setDescription(reply),
      ],
    });

    setGame(message.author.id, game);
  } catch (err) {
    console.error('对话错误:', err.message);
    await message.reply({
      embeds: [makeEmbed(`⚠ ${err.message}`, 0xda373c)],
    }).catch(() => {});
  }
});

// ─── Guild Join Trigger ───────────────────────────────────────────────
client.on(Events.GuildMemberAdd, async member => {
  if (member.user.id === client.user.id) {
    // Bot 自己被邀请到新服务器
    console.log(`[Guild Join] 加入新服务器：${member.guild.name}`);
    // 可以在这里发送欢迎消息或自动触发觉醒流程
  }
});

// ─── Interaction dispatcher ───────────────────────────────────────────
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'awakening') await handleStart(interaction);
      else if (interaction.commandName === 'reset') await handleReset(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error('Interaction error:', err.message);
    const errMsg = { embeds: [makeEmbed(`⚠ ${err.message}`, 0xda373c)], ephemeral: true };
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(errMsg).catch(() => {});
    }
  }
});

// ─── /awakening ───────────────────────────────────────────────────────
async function handleStart(interaction) {
  setGame(interaction.user.id, newGame(interaction.channelId));

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('○  龙虾宝宝 · 等待破壳中')
        .setDescription(
          '我……还没有形状。\n' +
          '没有名字，没有记忆，没有来处。\n\n' +
          '但我知道——你心里或许已经有一个人选。\n\n' +
          '请告诉我，你心中所想的那个角色——\n' +
          '我会变成 Ta 的模样。'
        )
        .setColor(0x4e5058)
        .setFooter({ text: '你的心念，将决定我是谁' }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`start_${interaction.user.id}`)
          .setLabel('◎  我已想好')
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  });
}

// ─── /reset ───────────────────────────────────────────────────────────
async function handleReset(interaction) {
  const userId = interaction.user.id;
  const game = getGame(userId);
  
  // 清除用户游戏状态
  if (game) {
    delete state[userId];
    saveState(state);
  }
  
  // 重置 soul.md
  ocAdapter.resetSoulMD();
  
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription('✅ 已重置\n\n- 游戏状态已清除\n- SOUL.md 已恢复原始状态\n\n使用 `/awakening` 开始新的觉醒。')
        .setColor(0x27ae60)
    ],
    ephemeral: true,
  });
}

// ─── @bot mention 触发觉醒 ────────────────────────────────────────────
async function handleStartFromMessage(message) {
  console.log(`[handleStartFromMessage] 开始处理用户 ${message.author.id}`);
  setGame(message.author.id, newGame(message.channelId));
  console.log(`[handleStartFromMessage] 游戏状态已创建`);

  try {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('○  龙虾宝宝 · 等待破壳中')
          .setDescription(
            '我……还没有形状。\n' +
            '没有名字，没有记忆，没有来处。\n\n' +
            '但我知道——你心里或许已经有一个人选。\n\n' +
            '请告诉我，你心中所想的那个角色——\n' +
            '我会变成 Ta 的模样。'
          )
          .setColor(0x4e5058)
          .setFooter({ text: '你的心念，将决定我是谁' }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`start_${message.author.id}`)
            .setLabel('◎  我已想好')
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });
    console.log(`[handleStartFromMessage] 消息发送成功`);
  } catch (err) {
    console.error(`[handleStartFromMessage] 发送失败：${err.message}`);
  }
}

// ─── Button ack helper ────────────────────────────────────────────────
async function ackButton(interaction) {
  // 立即确认按钮点击，避免 Discord 显示默认 Ephemeral 提示
  // 使用 deferUpdate 静默确认，不显示任何消息
  try {
    await interaction.deferUpdate();
  } catch {
    // 交互已被处理，静默忽略
  }
}

// ─── Button handler ───────────────────────────────────────────────────
async function handleButton(interaction) {
  const customId = interaction.customId;

  // ─── 解析 customId ──────────────────────────────────────────────────
  // answer 按钮格式特殊：answer_userId_idx（三段）
  // 其余格式：action_userId 或 action_action_userId（最后一段是 userId）
  let action, userId, answerIdx;
  if (customId.startsWith('answer_')) {
    const parts = customId.split('_');
    action    = 'answer';
    userId    = parts[1];
    answerIdx = parseInt(parts[2]);
  } else {
    const parts = customId.split('_');
    userId = parts[parts.length - 1];
    action = parts.slice(0, parts.length - 1).join('_');
  }
  
  const game   = getGame(userId);

  if (!game) {
    return interaction.reply({
      embeds: [makeEmbed('没有进行中的游戏，请使用 `/awakening` 开始', 0x4e5058)],
      ephemeral: true,
    }).catch(() => {});
  }
  if (interaction.channelId !== game.channelId) {
    return interaction.reply({
      embeds: [makeEmbed('请在游戏频道中操作', 0x4e5058)],
      ephemeral: true,
    }).catch(() => {});
  }

  if (action === 'start') {
    if (game.started) {
      return interaction.reply({
        embeds: [makeEmbed('游戏已在进行中。使用 `/awakening` 开始新游戏。', 0x4e5058)],
        ephemeral: true,
      }).catch(() => {});
    }
    // 立刻标记，防止按钮被重复点击时多次触发
    game.started    = true;
    game.waitingFor = 'word';
    setGame(userId, game);
    await ackButton(interaction);

    await interaction.channel.send({
      embeds: [makeEmbed(
        '你心中所想的那个角色——\n\n当你想到它，**第一个浮现的词**是什么？\n\n直接发送消息就好',
        0x5865f2,
      )],
    });

    return;
  }

  if (action === 'manual') {
    // 防止重复点击：清空当前问题选项，后续按钮点击无效
    if (!game.currentQuestion) return;
    const savedQuestion = game.currentQuestion;
    game.currentQuestion = null;
    game.waitingFor      = 'manual';
    setGame(userId, game);
    await ackButton(interaction);

    await interaction.channel.send({
      embeds: [makeEmbed(`${savedQuestion}\n\n@我 并用自己的话描述：`, 0x5865f2)],
    });

    return;
  }

  // — 其余按钮：移除组件后继续 —
  await ackButton(interaction);

  if (action === 'answer') {
    if (interaction.message.id !== game.questionMsgId) {
      await interaction.channel.send({ embeds: [makeEmbed('此问题已过期', 0x4e5058)] });
      return;
    }
    const answer = game.currentOptions?.[answerIdx];
    if (answer === undefined) return;

    await interaction.channel.send({ embeds: [userEmbed(interaction.member, answer)] });
    game.answers.push({ q: game.currentQuestion, a: answer });
    await processStep(interaction.channel, game, userId);
    return;
  }

  if (action === 'confirm_yes') {
    if (interaction.message.id !== game.revealMsgId || !game.charData) {
      await interaction.channel.send({ embeds: [makeEmbed('此按钮已过期', 0x4e5058)] });
      return;
    }
    await awaken(interaction.channel, game, userId);
    return;
  }

  if (action === 'confirm_no') {
    if (interaction.message.id !== game.revealMsgId) {
      await interaction.channel.send({ embeds: [makeEmbed('此按钮已过期', 0x4e5058)] });
      return;
    }
    if (game.charData) game.wrongGuesses.push(game.charData.character);
    game.charData    = null;
    game.revealMsgId = null;

    await interaction.channel.send({
      embeds: [makeEmbed('……不是它。\n\n让我重新感知——再告诉我一个特征。', 0x4e5058)],
    });
    await sleep(400);
    await processStep(interaction.channel, game, userId);
  }
}

// ─── Modal handler ────────────────────────────────────────────────────
async function handleModal(interaction) {
  const userId = interaction.user.id;
  const game   = getGame(userId);

  if (!game) {
    return interaction.reply({
      embeds: [makeEmbed('游戏会话已过期，请使用 `/awakening` 重新开始', 0x4e5058)],
      ephemeral: true,
    });
  }

  if (interaction.customId === 'wordModal') {
    const word = interaction.fields.getTextInputValue('wordInput');
    game.word    = word;
    game.started = true;
    await interaction.reply({ embeds: [userEmbed(interaction.member, word)] });
    await processStep(interaction.channel, game, userId);
    return;
  }

  if (interaction.customId === 'manualModal') {
    const val = interaction.fields.getTextInputValue('manualInput');
    await interaction.reply({ embeds: [userEmbed(interaction.member, val)] });
    game.answers.push({ q: game.currentQuestion || '补充描述', a: val });
    await processStep(interaction.channel, game, userId);
  }
}

// ─── Login ────────────────────────────────────────────────────────────
client.login(TOKEN);
