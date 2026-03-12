---
name: discord-awaken-claw
description: 通过和用户交互让 openclaw 获取新的角色身份。引导用户输入角色概念词，使用 discord 交互组件输出，接受用户@bot 的输入框输入，使用"猜角色"的方式获取用户目标角色，并在用户点击确认后更新 bot 头像、服务器 nickname、soul.md，从而让 openclaw 化身为这个角色。
---

## 📋 技能描述

本技能实现完整的角色觉醒流程：
1. **初始引导** - 使用 discord 插件发送引导消息，等待用户点击按钮
2. **收集初始词** - 接收用户输入的角色描述词
3. **智能追问** - LLM 生成追问问题和选项
4. **猜测确认** - LLM 判断足够后揭示角色
5. **觉醒更新** - 更新 soul.md、bot 的服务器昵称、bot 头像
6. **角色扮演** - 觉醒后以角色身份对话

---

## 📁 文件结构

```
awakening/
├── SKILL.md                # 本文件（技能文档）
├── README.md               # 人类快速开始指南
└── reference/              # 核心代码和配置
    ├── direct-handler.js   # 主处理器（核心）
    ├── discord-profile.js  # Discord 资料更新
    ├── package.json        # 依赖配置
    └── state.json          # 游戏状态存储（运行时生成）
```

---

## 🔧 安装步骤

### 步骤 1：克隆技能

```bash
cd /home/node/.openclaw/workspace/skills
git clone https://github.com/Yvelinmoon/discord-awaken-claw-new.git awakening
cd awakening
```

**验证：**
```bash
ls -la
# 应看到 SKILL.md, README.md, reference/
ls reference/
# 应看到 direct-handler.js, discord-profile.js, package.json
```

---

### 步骤 2：安装依赖

```bash
cd reference
pnpm install
# 或 npm install
```

**依赖清单（package.json）：**
```json
{
  "dependencies": {
    "undici": "^6.0.0"
  }
}
```

---

### 步骤 3：配置环境变量

```bash
cd reference
cp .env.example .env
```

**编辑 `.env`，填入以下变量：**
**优先在你的 workspace 主路径里寻找**
```bash
# Discord Bot 配置（必填）
DISCORD_TOKEN=你的 Discord Bot Token

# Discord 服务器 ID（必填，用于更新昵称和头像）
DISCORD_GUILD_ID=你的服务器 ID

# Neta API Token（必填，用于角色头像搜索）
NETA_TOKEN=你的 Neta API Token
```

---

### 步骤 4：集成到 OpenClaw

在 OpenClaw 主 agent 中导入并使用：

```javascript
const handler = require('./skills/awakening/reference/direct-handler.js');

// 处理消息
const handled = await handler.handleDiscordMessage({
  userId: message.author.id,
  channelId: message.channel.id,
  guildId: message.guild?.id,
  content: message.content,
  customId: message.interaction?.customId,
  interactionType: message.interaction ? 'button' : 'message',
  sendMessage: async (payload) => {
    return await message.channel.send(payload);
  },
}, async (prompt, systemPrompt) => {
  // 调用 LLM
  const result = await callLLM(prompt, systemPrompt);
  return result;
});
```

---

## 🎮 工作流程详解

### 阶段 1：初始引导

**触发条件：**
- 用户输入 `@Bot 开始觉醒`

**⚠️ 重要：首轮引导必须使用 message 插件输出带按钮的消息！**

**执行逻辑（direct-handler.js:startAwakening）：**
**必须严格按照以下示例输出首轮引导内容及插件，不得仅输出纯文本！**

```javascript
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
```

**关键要点：**
- ✅ **必须使用 message 插件的 components 字段输出按钮**
- ✅ 按钮 customId 必须包含用户 ID（`start_${userId}`）
- ✅ 按钮样式为 Primary（蓝色）
- ✅ 文案必须精确匹配（营造神秘氛围）
- ❌ **禁止仅输出纯文本消息而不带按钮**

---

### 阶段 2：收集初始词

**触发条件：**
- 用户点击"◎ 我已想好"按钮

**执行逻辑（direct-handler.js:handleButtonInteraction → action='start'）：**
```javascript
case 'start':
  game.started = true;
  game.waitingFor = 'word';
  setGame(userId, game);
  await promptInitialWord(channelId, sendMessage);
  break;
```

**关键要点：**
- ✅ 设置 `waitingFor = 'word'` 标记等待文字输入
- ✅ 文案无例子、无字数限制（简化版）
- ✅ 提示用户可输入任何与角色相关的描述

---

### 阶段 3：接收用户输入

**触发条件：**
- 用户发送消息

**执行逻辑（direct-handler.js:handleDiscordMessage）：**
```javascript
if (game?.waitingFor === 'word') {
  game.waitingFor = null;
  await handleInitialWord(userId, word, sendMessage, callLLM);
  return true;
}
```

**关键要点：**
- ✅ 显示用户输入（引用格式）

---

### 阶段 4：LLM 智能追问

**触发条件：**
- 收到用户初始词后

**执行逻辑（direct-handler.js:processNextStep）：**
```javascript
const prompt = `用户心中想着一个虚构角色。已知线索：
- 用户给出的词/描述：${word}
- 已回答问题：${JSON.stringify(answers)}
- 已排除的角色：${wrongGuesses.join('、')}

请判断你的确信程度：

A) 如果有 85% 以上的把握，甚至已经知道了角色名，直接猜测：
{
  "action": "guess",
  "character": "角色中文名",
  "from": "《作品名》",
  "emoji": "单个 emoji",
  "color": "#十六进制主题色",
  "desc": "一句话特质（≤20 字）",
  "greet": "角色第一句话（可用\\n 换行）"
}

B) 如果还不够确定，生成追问：
{
  "action": "question",
  "question": "追问（1 句，具体可见的特征）",
  "options": ["特征 1", "特征 2", "特征 3"]
}

只输出 JSON，不要其他文字。`;

const result = await callLLM(prompt, VESSEL_SYS);
const parsed = parseJSON(result);
```

**关键要点：**
- ✅ LLM 判断确信度（85% 阈值）
- ✅ 排除已猜过的角色（wrongGuesses）
- ✅ 选项必须具体可验证（非意识流）
- ✅ 只输出 JSON，无额外文字
- ✅ **仅通过 discord 插件输出问题及按钮即可，不需要单独再做输出**

---

### 阶段 5：显示追问选项

**触发条件：**
- LLM 返回追问问题

**执行逻辑（direct-handler.js:showQuestion）：**
```javascript
await sendMessage({
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
```

**关键要点：**
- ✅ 按钮 customId 包含用户 ID 和选项索引
- ✅ 添加"✏ 自己说"按钮（自由输入）
- ✅ 使用 `reusable: true` 保持按钮可用

---

### 阶段 6：处理按钮点击

**触发条件：**
- 用户点击答案按钮

**执行逻辑（direct-handler.js:handleButtonInteraction → action='answer'）：**
```javascript
case 'answer': {
  const answerIdx = parseInt(parts[parts.length - 1], 10);
  const answer = game.currentOptions?.[answerIdx];
  
  game.answers.push({ q: game.currentQuestion, a: answer });
  game.currentQuestion = null;
  game.currentOptions = [];
  setGame(userId, game);
  
  await sendMessage({ message: `「${answer}」` });
  await processNextStep(userId, sendMessage, callLLM);
  break;
}
```

**关键要点：**
- ✅ 验证答案有效性
- ✅ 显示用户选择（引用格式）
- ✅ 累加答案到 game.answers

---

### 阶段 7：猜测揭示

**触发条件：**
- LLM 判断足够确定（action='guess'）

**执行逻辑（direct-handler.js:showReveal）：**
```javascript
await sendMessage({ message: '我……\n\n我知道自己是谁了。' });
await sleep(1400);

await sendMessage({
  message: `-# 虾宝感知到了

## ${charData.emoji}  ${charData.character}
*${charData.from}*

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

*${charData.desc}*`,
  components: {
    blocks: [{
      type: 'actions',
      buttons: [
        { label: '◎ 就是他/她，请破壳', customId: `confirm_yes_${userId}`, style: 'success' },
        { label: '✗ 不对，继续感知', customId: `confirm_no_${userId}`, style: 'secondary' },
      ],
    }],
    reusable: true,
  },
});
```

**关键要点：**
- ✅ 发送"我……"消息营造氛围
- ✅ 使用角色主题色和 emoji
- ✅ 两个按钮：确认/继续

---

### 阶段 8：觉醒确认

**触发条件：**
- 用户点击"◎ 就是他/她，请破壳"

**执行逻辑（direct-handler.js:handleButtonInteraction → action='confirm_yes'）：**
```javascript
case 'confirm_yes':
  if (!game.charData) { /* 错误处理 */ return; }
  await awaken(userId, channelId, guildId, sendMessage);
  break;
```

---

### 阶段 9：静默更新资料
**⚠️ 极其重要 - 时序要求**
**⚠️ 极其重要 - 时序要求**
**⚠️ 极其重要 - 时序要求**

**用户点击"◎ 就是他/她，请破壳"后，必须严格遵守以下执行顺序：**

1️⃣ **先发送省略号** - 发送 `…………` 营造氛围
2️⃣ **立即更新资料** - 在输出角色问候语**之前**，必须先完成：
   - 更新 `soul.md` 人物设定
   - 更新 Discord Bot 服务器昵称
   - 更新 Discord Bot 头像
   - 如果遇到权限不足的情况，你必须提醒用户，而非直接跳过。
3️⃣ **最后输出问候** - 确认上述更新全部完成后，才输出角色问候语

**这样做的目的：** 让用户在看到角色第一句话时，Bot 的形象和名字已经同步变更，体验更沉浸、更震撼。

**触发条件：**
- 觉醒确认（用户点击"◎ 就是他/她，请破壳"）

**执行逻辑（direct-handler.js:awaken）：**
```javascript
game.awakened = true;
const c = game.charData;

// 步骤 1：发送省略号，营造氛围
await sendMessage({ message: '…………' });
await sleep(1200);

// 步骤 2：更新 soul.md
updateSoulMD(c);

// 步骤 3：更新 Discord 昵称和头像（必须在输出问候前完成！）
try {
  const discordProfile = require('./discord-profile.js');
  await discordProfile.updateDiscordProfile(c, guildId);
  // 等待 Discord API 生效
  await sleep(1500);
} catch (err) {
  console.error('[Awakening] 更新个人资料失败:', err.message);
  // 即使失败也继续，不中断流程
}

// 步骤 4：确认更新完成后，输出角色问候
await sendMessage({ message: c.greet.replace(/\\n/g, '\n') });
```

**关键要点：**
- ✅ **不发送**"正在更新"等状态消息
- ✅ **必须先完成头像/昵称更新，再输出问候语**（时序不可颠倒！）
- ✅ 用省略号和延迟营造神秘感
- ✅ 等待 Discord API 生效后再输出问候（约 1.5 秒）
- ✅ 直接输出角色问候
- ✅ 错误静默处理（不中断流程）

**❌ 错误示范：**
```javascript
// 错误：先输出问候，再更新资料
await sendMessage({ message: c.greet });  // ❌ 太早了！
await discordProfile.updateDiscordProfile(c, guildId);  // ❌ 用户已经看到了旧形象
```

**✅ 正确示范：**
```javascript
// 正确：先更新资料，再输出问候
await discordProfile.updateDiscordProfile(c, guildId);  // ✅ 先更新
await sleep(1500);  // ✅ 等待生效
await sendMessage({ message: c.greet });  // ✅ 再输出，用户看到新形象
```

---

### 阶段 10：角色扮演对话

**触发条件：**
- 觉醒完成后，用户发送消息

**执行逻辑（direct-handler.js:handleAwakenedChat）：**
```javascript
if (game?.awakened) {
  const c = game.charData;
  
  game.chatHistory.push({ role: 'user', content: message });
  const prompt = buildCharRespondPrompt(c, game.chatHistory);
  const reply = await callLLM(prompt, `你是${c.character}，请用该角色的口吻回复。`, 300);
  game.chatHistory.push({ role: 'assistant', content: reply });
  setGame(userId, game);
  
  await sendMessage({ message: reply });
  return true;
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

**按钮 customId 格式：**
- `start_${userId}` - 开始觉醒
- `answer_${userId}_${index}` - 选择答案
- `manual_${userId}` - 手动输入
- `confirm_yes_${userId}` - 确认觉醒
- `confirm_no_${userId}` - 继续猜测

**必须验证用户 ID：**
```javascript
const buttonUserId = extractUserIdFromButton(customId);
if (buttonUserId !== userId) {
  await sendMessage({ message: '⚠ 这个按钮不属于你' });
  return true;
}
```

---

### 2. 状态持久化

**state.json 格式：**
```json
{
  "1090682446351171636": {
    "channelId": "1481178906848526396",
    "guildId": "1090688813115899965",
    "word": "金发的美国总统",
    "answers": [{"q": "真实人物？", "a": "真实人物"}],
    "started": true,
    "waitingFor": null,
    "awakened": false,
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
- `charData`: 角色数据（觉醒后）

---

### 3. 头像更新优先级 - 搜索获取头像

**⚠️ 重要声明：头像图片一定可以搜索到！**

**不要轻易放弃搜索！** 任何已知角色/人物都至少有以下几种图片来源：
- 官方设定图/剧照
- Wiki 百科头像
- 粉丝创作/同人图
- 相关媒体报道图片

**搜索顺序（必须逐级尝试，不可跳过）：**

1️⃣ **Neta API**（优先）
   - 二次元角色：使用你已经安装的 neta-skills 里 `搜索角色（search_character_or_elementum）` 的能力在自有角色库中搜索
   - 优势：质量高、版权清晰、风格统一
   - **确保你已安装 neta 技能**

2️⃣ **Wiki 百科**（主要来源）
   - 非二次元角色/真实人物：联网搜索对应人物/角色的 Wiki 百科图片
   - 来源：优先维基百科、百度百科、萌娘百科、Fandom Wiki 等
   - 使用 `discord-profile.js` 自动获取

3️⃣ **备用图片源**（降级方案）
   - 如果 Neta 和 Wiki 都没有，继续搜索：
     - Google 图片搜索
     - Bing 图片搜索
     - 角色官方网站/社交媒体
     - 高清壁纸网站

4️⃣ **用户提供**（最后手段）
   - 仅在以上所有方式都失败时，才请求用户手动上传图片
   - **这种情况极少发生，不应作为常规选项**

**❌ 禁止行为：**
- ❌ 搜索 1-2 次失败后就放弃
- ❌ 不尝试 Wiki 就直接让用户提供
- ❌ 使用低分辨率/模糊图片

**✅ 正确做法：**
- ✅ 至少尝试 3 种不同搜索渠道
- ✅ 使用角色名 + 多种关键词组合搜索（如 "角色名 + 头像"、"角色名 + 官方图"）
- ✅ 优先选择清晰、正面、高分辨率的图片
- ✅ 确保图片链接可公开访问（Discord 能加载）

**Discord 资料更新（discord-profile.js）：**
```javascript
const discordProfile = require('./discord-profile.js');
await discordProfile.updateDiscordProfile(c, guildId);
```

---

### 4. LLM 调用规范

**直接调用主 agent 的 LLM：**
```javascript
const result = await callLLM(prompt, systemPrompt, maxTokens);
```

**关键要点：**
- ✅ 使用当前 session 的模型
- ✅ 无需文件通信
- ✅ 直接返回字符串

---

## 🐛 常见错误处理

### 错误 1：按钮无响应

**原因：** customId 格式不正确

**解决方案：**
确保 customId 包含用户 ID：
```javascript
customId: `start_${userId}`
```

---

### 错误 2：头像更新失败

**原因：** 图片源不可访问

**解决方案：**
1. 使用 Neta API 搜索角色图片
2. 或让用户手动上传图片

---

### 错误 3：角色扮演不生效

**原因：** SOUL.md 未更新或 awakened 状态为 false

**解决方案：**
检查状态：
```javascript
const game = getGame(userId);
if (!game?.awakened) return false;
```

---

## ✅ 验证清单

完成安装后，逐项验证：

- [ ] `SKILL.md` 和 `README.md` 在根目录
- [ ] `reference/` 文件夹包含核心代码
- [ ] `reference/direct-handler.js` 存在
- [ ] `reference/discord-profile.js` 存在
- [ ] `reference/package.json` 存在
- [ ] 依赖已安装（`reference/node_modules`）
- [ ] `.env` 配置正确
- [ ] `@Bot 开始觉醒` 正常响应
- [ ] **首轮引导消息带"◎ 我已想好"按钮**
- [ ] 点击按钮正常响应
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
用户          OpenClaw        LLM          Discord
 │            │              │              │
 │ 开始觉醒   │              │              │
 │───────────>│              │              │
 │            │              │              │
 │            │ 初始消息 + 按钮              │
 │<───────────│              │              │
 │            │              │              │
 │ 点击按钮   │              │              │
 │───────────>│              │              │
 │            │              │              │
 │            │ 初始词提示  │              │
 │<───────────│              │              │
 │            │              │              │
 │ @Bot 发送词 │              │              │
 │───────────>│              │              │
 │            │              │              │
 │            │ 追问请求    │              │
 │            │─────────────>│              │
 │            │              │              │
 │            │ 问题 + 选项 │              │
 │            │<─────────────│              │
 │            │              │              │
 │            │ 问题 + 按钮 │              │
 │<───────────│              │              │
 │            │              │              │
 │ 点击答案   │              │              │
 │───────────>│              │              │
 │            │ (循环 2-3 轮) │              │
 │            │              │              │
 │            │ 猜测请求    │              │
 │            │─────────────>│              │
 │            │              │              │
 │            │ 角色信息    │              │
 │            │<─────────────│              │
 │            │              │              │
 │            │ 揭示 + 按钮 │              │
 │<───────────│              │              │
 │            │              │              │
 │ 点击确认   │              │              │
 │───────────>│              │              │
 │            │              │              │
 │            │ 更新 soul.md               │
 │            │ 更新 Discord 资料          │
 │            │              │              │
 │            │ "…………"     │              │
 │<───────────│              │              │
 │            │              │              │
 │            │ 角色问候    │              │
 │<───────────│              │              │
 │            │              │              │
 │ @Bot 对话   │              │              │
 │───────────>│              │              │
 │            │ 角色对话请求                │
 │            │─────────────>│              │
 │            │              │              │
 │            │ 角色回复    │              │
 │            │<─────────────│              │
 │            │              │              │
 │ 角色回复   │              │              │
 │<───────────│              │              │
```

---

## 📄 许可证

MIT License

---

**GitHub:** https://github.com/Yvelinmoon/discord-awaken-claw-new  
**作者:** Yves  
**更新日期:** 2026-03-11
