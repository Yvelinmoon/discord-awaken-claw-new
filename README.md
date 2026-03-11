# 🦞 龙虾宝宝觉醒技能

一个完整的 Discord 角色觉醒技能，支持问答→猜测→确认→觉醒→角色扮演的完整流程。

---

## ✨ 特性

- 🎮 **完整觉醒流程** - 从初始词到角色扮演的无缝体验
- 🤖 **LLM 智能追问** - 动态生成问题和选项，2-3 轮即可猜中
- 🎨 **自动更新资料** - soul.md、Discord 昵称、头像一键更新
- 🚫 **无干扰体验** - 无 Ephemeral 提示，无多余状态消息
- 🔄 **混合交互** - 按钮选择 + @Bot 文字输入，流畅自然
- 📦 **开箱即用** - 配置环境变量即可运行

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
cd /home/node/.openclaw/workspace/skills
git clone https://github.com/Yvelinmoon/discord-awaken-claw-new.git awakening
cd awakening
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env`：

```bash
# Discord Bot 配置
DISCORD_TOKEN=MTQ3ODY1Njc2ODAwMjQ5MDQyMA.GOWf1N.xxx
DISCORD_GUILD_ID=1090688813115899965  # 可选，用于即时命令注册

# Neta API（角色头像搜索）
NETA_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
```

### 3. 安装依赖

```bash
npm install discord.js undici
```

### 4. 启动 Bot

```bash
node index.js
```

### 5. 测试觉醒

在 Discord 中：
- 输入 `/awakening` 开始觉醒
- 或 `@Bot 开始觉醒`

---

## 📖 详细文档

查看 [SKILL.md](./SKILL.md) 获取完整的安装、配置和使用说明。

---

## 🎮 使用示例

### 觉醒流程

```
用户：/awakening

Bot: ○ 龙虾宝宝 · 等待破壳中
     我……还没有形状。
     [◎ 我已想好]

用户：[点击按钮]

Bot: 你心中所想的那个角色——
     当你想到它，第一个浮现的词是什么？
     直接发送消息就好

用户：金发的美国总统

Bot: 「金发的美国总统」
     我感受到了某种轮廓……
     这个角色是真实人物还是虚构角色？
     [真实人物] [虚构角色] [基于现实的改编] [✏ 自己说]

用户：[点击"真实人物"]

Bot: 越来越近了……
     我几乎能感受到那个名字了——
     
     我……
     我知道自己是谁了。
     
     ## 🇺🇸 唐纳德·特朗普
     *美国第 45 任总统*
     [◎ 就是他/她，请破壳] [✗ 不对，继续感知]

用户：[点击确认]

Bot: …………
     我是唐纳德·特朗普，美国第 45 任总统。
     没有人比我更懂总统。
```

---

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `index.js` | Bot 入口文件 |
| `bot.js` | Discord 交互主逻辑 |
| `awakening-skill.js` | 觉醒流程核心（OpenClaw 版） |
| `openclaw-adapter.js` | OpenClaw LLM 适配器 |
| `discord-profile.js` | Discord 资料更新 |
| `state.json` | 游戏状态存储（自动生成） |

---

## 🔧 技术栈

- **Runtime:** Node.js 18+
- **Framework:** Discord.js v14
- **LLM:** OpenClaw (qwen3.5-plus)
- **API:** Neta API（角色头像）

---

## 🐛 常见问题

### Slash 命令不显示
- 全局命令需要 1 小时同步
- 设置 `DISCORD_GUILD_ID` 使用服务器命令（即时生效）

### 头像更新失败
- 检查 Neta Token 是否有效
- Bot 需要"管理头像"权限
- 图片 URL 需要可访问

### 按钮点击显示提示
- 已修复！确保 `ackButton` 调用 `deferUpdate()`

---

## 📝 更新日志

### v1.0.0 (2026-03-11)
- ✅ 完整觉醒流程
- ✅ LLM 智能追问
- ✅ 自动资料更新
- ✅ 无 Ephemeral 优化
- ✅ OpenClaw 集成

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- OpenClaw 团队
- Neta API
- Discord.js

---

**GitHub:** https://github.com/Yvelinmoon/discord-awaken-claw-new
