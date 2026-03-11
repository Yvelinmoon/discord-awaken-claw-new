---
name: discord-awaken-claw
description: 通过和用户交互让openclaw获取新的角色身份。引导用户输入角色概念词，使用discord交互组件输出，接受用户@bot的输入框输入，使用“猜角色”的方式获取用户目标角色，并在用户点击确认后更新bot头像，nickname，soul.md，从而让openclaw化身为这个角色。
---

## 📋 技能描述

本技能实现完整的角色觉醒流程：
1. **初始引导** - 发送引导消息，等待用户点击按钮
2. **收集初始词** - 接收用户输入的角色描述词
3. **智能追问** - LLM 生成追问问题和选项
4. **猜测确认** - LLM 判断足够后揭示角色
5. **觉醒更新** - 更新 soul.md、昵称、头像
6. **角色扮演** - 觉醒后以角色身份对话

---

## 🎯 核心目标

让其他 OpenClaw Bot **完全复刻**当前觉醒流程，包括：
- ✅ 引导组件的样式和文案
- ✅ 按钮交互的处理逻辑
- ✅ LLM 追问的判断机制
- ✅ 资料更新的静默执行
- ✅ 角色问候的无缝衔接

---

## 📁 文件结构

```
awakening/
├── index.js              # 入口文件，启动 Bot
├── bot.js                # Discord 交互主逻辑
├── awakening-skill.js    # 觉醒流程核心（OpenClaw 集成版）
├── openclaw-adapter.js   # OpenClaw LLM 适配器
├── discord-profile.js    # Discord 资料更新
├── state.json            # 游戏状态存储（运行时生成）
├── package.json          # 依赖配置
├── .env.example          # 环境变量示例
├── SKILL.md              # 本文件
└── README.md             # 人类快速开始指南
```

---

## 🔧 安装步骤

### 步骤 1：克隆技能

**执行脚本：**
```bash
cd /home/node/.openclaw/workspace/skills
git clone https://github.com/Yvelinmoon/discord-awaken-claw-new.git awakening
cd awakening
```

**验证：**
```bash
ls -la
# 应看到 index.js, bot.js, awakening-skill.js 等文件
```

---

### 步骤 2：安装依赖

**执行脚本：**
```bash
npm install
```

**依赖清单（package.json）：**
```json
{
  "dependencies": {
    "discord.js": "^14.14.1",
    "undici": "^6.0.0"
  }
}
```

**验证：**
```bash
node -e "require('discord.js'); console.log('discord.js OK')"
```

---

### 步骤 3：配置环境变量

**执行脚本：**
```bash
cp .env.example .env
```

**编辑 `.env`，填入以下变量：**

```bash
# Discord Bot 配置（必填）
DISCORD_TOKEN=你的 Discord Bot Token
# 获取方式：https://discord.com/developers/applications → Bot → Reset Token

# Discord 服务器 ID（可选，用于即时命令注册）
DISCORD_GUILD_ID=你的服务器 ID
# 获取方式：Discord 设置 → 高级 → 开发者模式 → 右键服务器复制 ID

# Neta API Token（必填，用于角色头像搜索）
NETA_TOKEN=你的 Neta API Token
# 获取方式：联系 Neta API 管理员

# OpenClaw 配置（可选，默认使用 workspace 配置）
# OPENCLAW_WORKSPACE=/home/node/.openclaw/workspace
```

**验证：**
```bash
node -e "require('dotenv').config(); console.log(process.env.DISCORD_TOKEN ? 'Token OK' : 'Token Missing')"
```

---

### 步骤 4：启动 Bot

**执行脚本：**
```bash
node index.js
```

**预期输出：**
```
✦ 龙虾宝宝已上线 → YourBot#1234
  邀请链接：https://discord.com/oauth2/authorize?client_id=xxx
✦ Slash 命令已注册
```

**验证：**
- Bot 在 Discord 中显示在线
- 输入 `/` 能看到 `awakening` 和 `reset` 命令

---

## 🎮 工作流程详解

### 阶段 1：初始引导

**触发条件：**
- 用户输入 `/awakening`
- 或用户 `@Bot 开始觉醒`

**执行逻辑（bot.js:handleStart）：**
```javascript
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
        .setCustomId(`start_${userId}`)
        .setLabel('◎  我已想好')
        .setStyle(ButtonStyle.Primary)
    ),
  ],
});
```

**关键要点：**
- ✅ 使用 Embed 格式，灰色主题（0x4e5058）
- ✅ 按钮 customId 必须包含用户 ID（`start_${userId}`）
- ✅ 按钮样式为 Primary（蓝色）
- ✅ 文案必须精确匹配（营造神秘氛围）

---

### 阶段 2：收集初始词

**触发条件：**
- 用户点击"◎ 我已想好"按钮

**执行逻辑（bot.js:handleButton → action='start'）：**
```javascript
// 1. 静默确认按钮点击（避免 Ephemeral 提示）
await ackButton(interaction); // deferUpdate()

// 2. 发送初始词提示
await interaction.channel.send({
  embeds: [makeEmbed(
    '你心中所想的那个角色——\n\n当你想到它，**第一个浮现的词**是什么？\n\n直接发送消息就好',
    0x5865f2,
  )],
});

// 3. 更新状态
game.started = true;
game.waitingFor = 'word';
setGame(userId, game);
```

**关键要点：**
- ✅ 必须调用 `deferUpdate()` 避免系统提示
- ✅ 文案无例子、无字数限制（简化版）
- ✅ 设置 `waitingFor = 'word'` 标记等待文字输入

---

### 阶段 3：接收用户输入

**触发条件：**
- 用户发送消息（且消息包含 @Bot）

**执行逻辑（bot.js:MessageCreate）：**
```javascript
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;
  if (!message.mentions.has(client.user)) return;
  
  const content = message.content.replace(/<@!?\d+>/g, '').trim();
  const game = getGame(message.author.id);
  
  // 等待初始词状态
  if (game?.waitingFor === 'word') {
    game.waitingFor = null;
    game.word = content.slice(0, 20);
    setGame(userId, game);
    
    // 显示用户输入
    await message.channel.send({ 
      embeds: [userEmbed(message.member, content)] 
    });
    
    // 进入下一步
    await processStep(message.channel, game, userId);
    return;
  }
});
```

**关键要点：**
- ✅ 只响应包含 @Bot 的消息
- ✅ 清除消息中的 @Bot 标记
- ✅ 限制 20 字（防止过长）
- ✅ 显示用户输入（引用格式）

---

### 阶段 4：LLM 智能追问

**触发条件：**
- 收到用户初始词后

**执行逻辑（bot.js:processStep → nextStep）：**
```javascript
async function nextStep(word, answers, wrongGuesses) {
  const prompt = `用户心中想着一个虚构角色。已知线索：
- 用户给出的词/描述：${word}
- 已回答问题：${JSON.stringify(answers)}
- 已排除的角色：${wrongGuesses.join('、')}

请判断你的确信程度：

A) 如果有 85% 以上的把握，直接猜测：
{
  "action": "guess",
  "character": "角色中文名",
  "from": "《作品名》",
  "emoji": "单个 emoji",
  "color": "#十六进制主题色",
  "desc": "一句话特质（≤20 字）",
  "greet": "角色第一句话（可用\\n换行）"
}

B) 如果还不够确定，生成追问：
{
  "action": "question",
  "question": "追问（1 句，具体可见的特征）",
  "options": ["特征 1", "特征 2", "特征 3"]
}

选项要求：具体可验证，有明显区分度。
只输出 JSON，不要其他文字。`;

  const raw = await callOpenClaw(prompt, systemPrompt);
  return JSON.parse(raw);
}
```

**关键要点：**
- ✅ LLM 判断确信度（85% 阈值）
- ✅ 排除已猜过的角色（wrongGuesses）
- ✅ 选项必须具体可验证（非意识流）
- ✅ 只输出 JSON，无额外文字

---

### 阶段 5：显示追问选项

**触发条件：**
- LLM 返回追问问题

**执行逻辑（bot.js:showQuestionEmbed）：**
```javascript
async function showQuestionEmbed(channel, game, result, userId) {
  game.currentQuestion = result.question;
  game.currentOptions = result.options;
  setGame(userId, game);
  
  // 生成按钮
  const optBtns = result.options.map((opt, i) =>
    new ButtonBuilder()
      .setCustomId(`answer_${userId}_${i}`)
      .setLabel(opt)
      .setStyle(ButtonStyle.Secondary)
  );
  
  // 添加"自己说"按钮
  optBtns.push(
    new ButtonBuilder()
      .setCustomId(`manual_${userId}`)
      .setLabel('✏ 自己说')
      .setStyle(ButtonStyle.Secondary)
  );
  
  // 发送消息
  const msg = await channel.send({
    embeds: [makeEmbed(result.question, 0x5865f2)],
    components: [new ActionRowBuilder().addComponents(...optBtns)],
  });
  
  game.questionMsgId = msg.id;
  setGame(userId, game);
}
```

**关键要点：**
- ✅ 按钮 customId 包含用户 ID 和选项索引
- ✅ 添加"✏ 自己说"按钮（自由输入）
- ✅ 记录消息 ID（验证按钮点击有效性）
- ✅ 蓝色主题（0x5865f2）

---

### 阶段 6：处理按钮点击

**触发条件：**
- 用户点击答案按钮

**执行逻辑（bot.js:handleButton → action='answer'）：**
```javascript
if (action === 'answer') {
  // 验证消息有效性
  if (interaction.message.id !== game.questionMsgId) {
    await interaction.channel.send({ 
      embeds: [makeEmbed('此问题已过期', 0x4e5058)] 
    });
    return;
  }
  
  // 静默确认
  await ackButton(interaction);
  
  // 获取答案
  const answer = game.currentOptions?.[answerIdx];
  
  // 显示用户选择
  await interaction.channel.send({ 
    embeds: [userEmbed(interaction.member, answer)] 
  });
  
  // 记录答案
  game.answers.push({ q: game.currentQuestion, a: answer });
  
  // 进入下一步
  await processStep(interaction.channel, game, userId);
}
```

**关键要点：**
- ✅ 验证消息 ID（防止过期按钮）
- ✅ 静默确认（deferUpdate）
- ✅ 显示用户选择（引用格式）
- ✅ 累加答案到 game.answers

---

### 阶段 7：猜测揭示

**触发条件：**
- LLM 判断足够确定（action='guess'）

**执行逻辑（bot.js:showReveal）：**
```javascript
async function showReveal(channel, game, charData, userId) {
  game.charData = charData;
  setGame(userId, game);
  
  // 氛围营造
  await channel.sendTyping();
  await sleep(1400);
  await channel.send({ 
    embeds: [makeEmbed('我……\n\n我知道自己是谁了。', 0x9c27b0)] 
  });
  
  await sleep(900);
  
  // 显示角色信息
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(hexToInt(charData.color))
        .setAuthor({ name: `${charData.emoji} ${charData.character}` })
        .setDescription(
          `## ${charData.character}\n*${charData.from}*\n\n${charData.desc}`
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_yes_${userId}`)
          .setLabel('◎  就是他/她，请破壳')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`confirm_no_${userId}`)
          .setLabel('✗  不对，继续感知')
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
  
  game.revealMsgId = msg.id;
  setGame(userId, game);
}
```

**关键要点：**
- ✅ 发送"我……"消息营造氛围
- ✅ 延迟 1.4 秒 + 0.9 秒（节奏控制）
- ✅ 使用角色主题色和 emoji
- ✅ 两个按钮：确认/继续

---

### 阶段 8：觉醒确认

**触发条件：**
- 用户点击"◎ 就是他/她，请破壳"

**执行逻辑（bot.js:handleButton → action='confirm_yes'）：**
```javascript
if (action === 'confirm_yes') {
  // 验证有效性
  if (interaction.message.id !== game.revealMsgId || !game.charData) {
    await interaction.channel.send({ 
      embeds: [makeEmbed('此按钮已过期', 0x4e5058)] 
    });
    return;
  }
  
  // 静默确认
  await ackButton(interaction);
  
  // 执行觉醒
  await awaken(interaction.channel, game, userId);
}
```

---

### 阶段 9：静默更新资料

**触发条件：**
- 觉醒确认

**执行逻辑（bot.js:awaken）：**
```javascript
async function awaken(channel, game, userId) {
  const c = game.charData;
  
  // 1. 更新 soul.md（静默，无提示）
  updateSoulMD(c);
  
  // 2. 更新 Discord 资料（静默，无提示）
  try {
    await discordProfile.updateDiscordProfile(c, guildId);
  } catch (err) {
    console.error('[Awakening] 更新失败:', err.message);
  }
  
  // 3. 氛围营造
  await channel.send({ message: '…………' });
  await sleep(1200);
  
  // 4. 无缝衔接角色问候（无提示文字）
  await channel.send({ 
    message: c.greet.replace(/\\n/g, '\n') 
  });
  
  game.awakened = true;
  setGame(userId, game);
}
```

**关键要点：**
- ✅ **不发送**"正在更新"等状态消息
- ✅ 用省略号和延迟营造神秘感
- ✅ 直接输出角色问候
- ✅ 错误静默处理（不中断流程）

---

### 阶段 10：角色扮演对话

**触发条件：**
- 觉醒完成后，用户 @Bot 发送消息

**执行逻辑（bot.js:MessageCreate → awakened 状态）：**
```javascript
if (game?.awakened) {
  const charData = game.charData;
  
  // 构建角色对话 prompt
  const systemPrompt = `你现在完全是${charData.character}，来自${charData.from}。
用该角色真实的口吻、性格、语言习惯回应用户。
回复简洁（1-3 句），完全保持角色个性，不要打破第四面墙，不要提到自己是 AI。`;
  
  // 调用 LLM
  const reply = await charRespond(charData, game.chatHistory);
  
  // 发送回复
  await message.reply(reply);
  
  // 记录对话历史
  game.chatHistory.push({ role: 'user', content: message.content });
  game.chatHistory.push({ role: 'assistant', content: reply });
  setGame(userId, game);
}
```

**关键要点：**
- ✅ 完全保持角色人设
- ✅ 不打破第四面墙
- ✅ 回复简洁（1-3 句）
- ✅ 记录对话历史（上下文）

---

## ⚠️ 注意事项

### 1. 按钮点击处理

**必须调用 `deferUpdate()`：**
```javascript
async function ackButton(interaction) {
  try {
    await interaction.deferUpdate();
  } catch {
    // 静默忽略
  }
}
```

**否则会出现：**
- ❌ Discord 显示"Bot 已收到"临时提示
- ❌ 提示带 Bot 原始头像（觉醒后不一致）

---

### 2. 状态持久化

**state.json 格式：**
```json
{
  "1090682446351171636": {
    "word": "金发的美国总统",
    "answers": [{"q": "真实人物？", "a": "真实人物"}],
    "started": true,
    "waitingFor": null,
    "awakened": false,
    "channelId": "1480370487413575700",
    "charData": {
      "character": "唐纳德·特朗普",
      "from": "美国第 45 任总统",
      "emoji": "🇺🇸",
      "color": "#FFD700",
      "desc": "商人、政治人物",
      "greet": "我是唐纳德·特朗普"
    }
  }
}
```

**关键状态字段：**
- `waitingFor`: 控制输入类型（'word' | 'manual' | null）
- `awakened`: 觉醒完成标记
- `questionMsgId`: 验证按钮有效性
- `revealMsgId`: 验证确认按钮有效性

---

### 3. 头像更新优先级

**搜索顺序：**
1. **Neta API** - 角色库（优先，质量高）
2. **维基百科** - 真实人物（带 User-Agent 头）
3. **预定义库** - 备用

**下载验证：**
```javascript
async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; OpenClaw Bot/1.0)'
    }
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 1000) throw new Error('图片太小，无效');
  
  return Buffer.from(buffer);
}
```

---

### 4. LLM 调用规范

**OpenClaw 适配器（openclaw-adapter.js）：**
```javascript
async function callOpenClaw(prompt, systemPrompt, maxTokens = 600) {
  // 写入请求文件
  const requestId = generateId();
  const requestFile = `.llm-requests/${requestId}.json`;
  fs.writeFileSync(requestFile, JSON.stringify({
    prompt,
    systemPrompt,
    maxTokens
  }));
  
  // 等待响应文件
  const responseFile = `.llm-responses/${requestId}.json`;
  while (!fs.existsSync(responseFile)) {
    await sleep(100);
  }
  
  // 读取响应
  const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
  return response.content;
}
```

**关键要点：**
- ✅ 文件通信（非 API 调用）
- ✅ 轮询等待响应
- ✅ 清理临时文件

---

## 🐛 常见错误处理

### 错误 1：Slash 命令不显示

**原因：** 全局命令同步延迟（1 小时）

**解决方案：**
```javascript
// 使用服务器命令（即时生效）
await guild.commands.set([...]);
```

**配置：**
```bash
DISCORD_GUILD_ID=你的服务器 ID
```

---

### 错误 2：头像更新失败 403

**原因：** 维基百科拒绝无 User-Agent 请求

**解决方案：**
```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (compatible; OpenClaw Bot/1.0)'
}
```

---

### 错误 3：按钮点击无反应

**原因：** 未调用 `deferUpdate()`

**解决方案：**
```javascript
await interaction.deferUpdate();
```

---

## ✅ 验证清单

完成安装后，逐项验证：

- [ ] Bot 在 Discord 中显示在线
- [ ] `/awakening` 命令可用
- [ ] 点击"◎ 我已想好"无 Ephemeral 提示
- [ ] 初始词输入正常响应
- [ ] 追问按钮正常显示
- [ ] 猜测揭示有氛围消息（"我……"）
- [ ] 觉醒后昵称更新
- [ ] 觉醒后头像更新
- [ ] 觉醒后角色扮演正常
- [ ] 无多余状态提示消息

---

## 📊 完整流程时序图

```
用户          Bot           LLM          Discord API
 │            │             │               │
 │ /awakening │             │               │
 │───────────>│             │               │
 │            │             │               │
 │            │ 初始消息 + 按钮              │
 │<───────────│             │               │
 │            │             │               │
 │ 点击按钮   │             │               │
 │───────────>│             │               │
 │            │ deferUpdate │               │
 │            │────────────>│               │
 │            │             │               │
 │            │ 初始词提示  │               │
 │<───────────│             │               │
 │            │             │               │
 │ @Bot 发送词 │             │               │
 │───────────>│             │               │
 │            │             │               │
 │            │ 追问请求    │               │
 │            │────────────>│               │
 │            │             │               │
 │            │ 问题 + 选项 │               │
 │            │<────────────│               │
 │            │             │               │
 │            │ 问题 + 按钮 │               │
 │<───────────│             │               │
 │            │             │               │
 │ 点击答案   │             │               │
 │───────────>│             │               │
 │            │ (循环 2-3 轮) │               │
 │            │             │               │
 │            │ 猜测请求    │               │
 │            │────────────>│               │
 │            │             │               │
 │            │ 角色信息    │               │
 │            │<────────────│               │
 │            │             │               │
 │            │ 揭示 + 按钮 │               │
 │<───────────│             │               │
 │            │             │               │
 │ 点击确认   │             │               │
 │───────────>│             │               │
 │            │             │               │
 │            │ 更新 soul.md               │
 │            │────────────────────────────>│
 │            │ 更新昵称/头像              │
 │            │────────────────────────────>│
 │            │             │               │
 │            │ "…………"     │               │
 │<───────────│             │               │
 │            │             │               │
 │            │ 角色问候    │               │
 │<───────────│             │               │
 │            │             │               │
 │ @Bot 对话   │             │               │
 │───────────>│             │               │
 │            │ 角色对话请求                │
 │            │────────────>│               │
 │            │             │               │
 │            │ 角色回复    │               │
 │            │<────────────│               │
 │            │             │               │
 │ 角色回复   │             │               │
 │<───────────│             │               │
```

---

## 📄 许可证

MIT License

---

**GitHub:** https://github.com/Yvelinmoon/discord-awaken-claw-new  
**作者:** Yves  
**更新日期:** 2026-03-11
