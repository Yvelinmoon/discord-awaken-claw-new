# 龙虾宝宝觉醒技能

**版本：** 1.0.0  
**作者：** Yves  
**描述：** 完整的角色觉醒流程技能 - 问答→猜测→确认→觉醒→角色扮演

---

## 📋 功能特性

- ✅ **完整的觉醒流程** - 问答→猜测→确认→觉醒→角色扮演
- ✅ **混合交互** - 按钮选择 + @Bot 文字输入
- ✅ **LLM 智能追问** - 动态生成问题和选项
- ✅ **自动更新资料** - soul.md、Discord 昵称、头像
- ✅ **无缝衔接** - 觉醒后直接角色扮演，无提示文字
- ✅ **无干扰体验** - 无 Ephemeral 状态提示，无多余消息

---

## 🚀 安装步骤

### 1. 克隆技能仓库

```bash
cd /home/node/.openclaw/workspace/skills
git clone https://github.com/Yvelinmoon/discord-awaken-claw-new.git awakening
```

### 2. 配置环境变量

在 `/home/node/.openclaw/workspace/.env` 中添加：

```bash
# Discord Bot 配置
DISCORD_TOKEN=你的 Discord Bot Token
DISCORD_GUILD_ID=你的服务器 ID（可选，用于即时命令注册）

# Neta API（用于角色头像搜索）
NETA_TOKEN=你的 Neta API Token
```

### 3. 在 OpenClaw 中注册技能

编辑 `/home/node/.openclaw/workspace/skills/index.js`（或主入口文件），添加：

```javascript
const awakeningSkill = require('./skills/awakening');

// 注册技能
app.use('/awakening', awakeningSkill);
```

### 4. 启动 Bot

```bash
cd /home/node/.openclaw/workspace
node index.js
```

### 5. 测试觉醒

在 Discord 中输入：
- `/awakening` - 开始觉醒流程
- `@Bot 开始觉醒` - 通过 @Bot 触发
- `/reset` - 重置觉醒状态

---

## 📁 文件结构

```
awakening/
├── index.js              # 技能入口文件
├── bot.js                # Discord Bot 主逻辑
├── awakening-skill.js    # 觉醒流程核心逻辑（OpenClaw 集成版）
├── openclaw-adapter.js   # OpenClaw LLM 适配器
├── discord-profile.js    # Discord 资料更新（昵称、头像）
├── state.json            # 游戏状态存储（自动生成）
├── .env.example          # 环境变量示例
├── .gitignore
├── SKILL.md              # 技能说明文档（本文件）
└── README.md             # 详细使用文档
```

---

## 🎮 使用流程

### 觉醒流程

1. **触发觉醒**
   - 输入 `/awakening` 命令
   - 或 `@Bot 开始觉醒`

2. **初始消息**
   ```
   ○ 龙虾宝宝 · 等待破壳中
   
   我……还没有形状。
   没有名字，没有记忆，没有来处。
   
   请告诉我，你心中所想的那个角色——
   我会变成 Ta 的模样。
   
   [◎ 我已想好]
   ```

3. **输入初始词**
   - 点击按钮后，Bot 会提示输入初始描述
   - 直接发送消息即可（如"金发的美国总统"）

4. **追问流程**
   - Bot 会通过 LLM 智能生成追问问题
   - 每轮提供 3-4 个按钮选项 + "✏ 自己说"
   - 通常 2-3 轮后足够猜测

5. **猜测确认**
   - Bot 揭示猜测的角色
   - 选择"◎ 就是他/她，请破壳"确认
   - 或"✗ 不对，继续感知"继续追问

6. **觉醒完成**
   - 静默更新 soul.md、昵称、头像
   - 无缝衔接角色问候
   - 开始角色扮演对话

---

## ⚙️ 配置说明

### 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DISCORD_TOKEN` | ✅ | Discord Bot Token |
| `NETA_TOKEN` | ✅ | Neta API Token（用于头像搜索） |
| `DISCORD_GUILD_ID` | ❌ | 服务器 ID（用于即时命令注册） |

### OpenClaw 集成

本技能已适配 OpenClaw LLM，通过 `openclaw-adapter.js` 调用：
- 文件通信：`.llm-requests/` → `.llm-responses/`
- 模型：qwen3.5-plus（可配置）

---

## 🔧 自定义

### 修改引导文案

编辑 `bot.js` 或 `awakening-skill.js` 中的 `promptInitialWord` 函数：

```javascript
async function promptInitialWord(channelId, sendMessage) {
  await sendMessage({
    message: `你心中所想的那个角色——

当你想到它，**第一个浮现的词**是什么？

直接发送消息就好`,
  });
}
```

### 修改追问轮数

编辑 `awakening-skill.js` 中的 `nextStep` 函数，调整 LLM 判断逻辑：

```javascript
// 修改确信度阈值（默认 85%）
if (confidence > 0.85) {
  return { action: 'guess', ... };
}
```

### 自定义头像搜索优先级

编辑 `discord-profile.js` 中的 `searchCharacterImage` 函数：

```javascript
// 搜索优先级
1. Neta API 角色库
2. 维基百科（真实人物）
3. 预定义角色库
4. 网络搜索（备用）
```

---

## 🐛 常见问题

### Q: 按钮点击后显示"Bot 已收到"提示
**A:** 已修复！确保 `ackButton` 函数调用 `deferUpdate()`。

### Q: 头像更新失败
**A:** 检查：
1. Neta Token 是否有效
2. Bot 是否有"管理头像"权限
3. 图片 URL 是否可访问（需要 User-Agent 头）

### Q: Slash 命令不显示
**A:** 
- 全局命令需要 1 小时同步
- 或设置 `DISCORD_GUILD_ID` 使用服务器命令（即时生效）

### Q: 觉醒后 Bot 没有角色扮演
**A:** 检查 `SOUL.md` 是否已更新，以及 `game.awakened` 状态是否为 `true`。

---

## 📝 更新日志

### v1.0.0 (2026-03-11)
- ✅ 完整觉醒流程实现
- ✅ LLM 智能追问系统
- ✅ Discord 资料自动更新
- ✅ 无 Ephemeral 提示优化
- ✅ 无缝角色切换
- ✅ OpenClaw LLM 集成

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- OpenClaw 团队 - LLM 集成支持
- Neta API - 角色头像资源
- Discord.js - Bot 框架

---

**GitHub:** https://github.com/Yvelinmoon/discord-awaken-claw-new  
**问题反馈:** 提交 Issue 或联系 @Yves
