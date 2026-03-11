# 🦞 龙虾宝宝觉醒技能

一个完整的 Discord 角色觉醒技能，通过问答→猜测→确认→觉醒→角色扮演的完整流程，让 Bot 变成用户心中的角色。

---

## ✨ 特性

- 🎮 **完整觉醒流程** - 从初始词到角色扮演的无缝体验
- 🤖 **LLM 智能追问** - 动态生成问题和选项，2-3 轮即可猜中
- 🎨 **自动更新资料** - soul.md、Discord 昵称、头像一键更新
- 🚫 **无干扰体验** - 无 Ephemeral 提示，无多余状态消息
- 🔄 **混合交互** - 按钮选择 + @Bot 文字输入，流畅自然

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
cd /home/node/.openclaw/workspace/skills
git clone https://github.com/Yvelinmoon/discord-awaken-claw-new.git awakening
cd awakening
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的 DISCORD_TOKEN 和 NETA_TOKEN
```

### 3. 安装依赖

```bash
npm install
```

### 4. 启动 Bot

```bash
node index.js
```

### 5. 测试觉醒

在 Discord 中输入 `/awakening` 或 `@Bot 开始觉醒`

---

## 📖 详细文档

- **[SKILL.md](./SKILL.md)** - Agent 技能规范（详细工作流程）
- **[DEPLOY.md](./DEPLOY.md)** - 部署指南和故障排查

---

## 🎮 使用示例

```
用户：/awakening

Bot: ○ 龙虾宝宝 · 等待破壳中
     [◎ 我已想好]

用户：[点击按钮] → 输入"金发的美国总统" → 选择"真实人物"

Bot: ## 🇺🇸 唐纳德·特朗普
     [◎ 就是他/她，请破壳]

用户：[点击确认]

Bot: 我是唐纳德·特朗普，美国第 45 任总统。
```

---

## 📄 许可证

MIT License

**GitHub:** https://github.com/Yvelinmoon/discord-awaken-claw-new
