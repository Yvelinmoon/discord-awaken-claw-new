# 🚀 部署指南

快速将龙虾宝宝觉醒技能部署到你的 OpenClaw Bot。

---

## 📋 前提条件

- ✅ Node.js 18+
- ✅ Discord Bot 及 Token
- ✅ OpenClaw 工作区
- ✅ Neta API Token（可选，用于头像搜索）

---

## 🔧 步骤 1：克隆技能

```bash
cd /home/node/.openclaw/workspace/skills
git clone https://github.com/Yvelinmoon/discord-awaken-claw-new.git awakening
cd awakening
```

---

## 🔧 步骤 2：安装依赖

```bash
npm install
```

这会安装：
- `discord.js` v14
- `undici` v6

---

## 🔧 步骤 3：配置环境变量

### 方法 A：复制到主工作区

```bash
cp .env.example /home/node/.openclaw/workspace/.env
```

然后编辑 `/home/node/.openclaw/workspace/.env`：

```bash
DISCORD_TOKEN=你的 Discord Bot Token
DISCORD_GUILD_ID=你的服务器 ID（可选）
NETA_TOKEN=你的 Neta API Token
```

### 方法 B：直接在技能目录创建

```bash
cp .env.example .env
nano .env  # 或使用你喜欢的编辑器
```

---

## 🔧 步骤 4：注册 Slash 命令

### 方式 A：全局命令（推荐）

Bot 启动时会自动注册全局命令，但需要 **1 小时** 才能在全球生效。

### 方式 B：服务器命令（即时生效）

在 `.env` 中设置 `DISCORD_GUILD_ID`，Bot 启动时会自动注册服务器命令。

```bash
DISCORD_GUILD_ID=1090688813115899965
```

---

## 🔧 步骤 5：启动 Bot

### 方式 A：直接运行

```bash
node index.js
```

### 方式 B：使用 npm

```bash
npm start
```

### 方式 C：开发模式（自动重载）

```bash
npm run dev
```

---

## 🔧 步骤 6：测试觉醒

在 Discord 中：

1. **使用 Slash 命令**
   ```
   /awakening
   ```

2. **或 @Bot 触发**
   ```
   @Bot 开始觉醒
   ```

3. **完成觉醒流程**
   - 点击按钮
   - 输入初始词
   - 回答问题
   - 确认角色

4. **测试角色扮演**
   ```
   @Bot 你好
   ```

---

## 🔍 故障排查

### Bot 不响应命令

1. 检查 Bot 是否在线
2. 检查 Bot 权限（需要"读取消息"、"发送消息"、"使用应用命令"）
3. 等待全局命令同步（最多 1 小时）
4. 或使用服务器命令（设置 `DISCORD_GUILD_ID`）

### 头像更新失败

1. 检查 Neta Token 是否有效
2. 检查 Bot 权限（需要"管理头像"）
3. 查看日志错误信息

### 按钮点击无反应

1. 检查 Bot 权限（需要"使用外部表情符号"）
2. 查看控制台日志
3. 确保 `state.json` 可写

---

## 📊 监控日志

```bash
# 查看实时日志
tail -f /tmp/openclaw/openclaw-*.log

# 或查看 Bot 控制台输出
```

关键日志标记：
- `[Guild Join]` - Bot 加入新服务器
- `[Interaction]` - 按钮/命令交互
- `[OpenClaw Call]` - LLM 调用
- `[Discord]` - 资料更新

---

## 🔄 更新技能

```bash
cd /home/node/.openclaw/workspace/skills/awakening
git pull origin main
npm install  # 如果有新依赖
```

---

## 📁 目录结构

```
/home/node/.openclaw/workspace/
├── .env                    # 环境变量
├── SOUL.md                 # 角色设定（觉醒后更新）
├── skills/
│   └── awakening/          # 觉醒技能
│       ├── index.js
│       ├── bot.js
│       ├── awakening-skill.js
│       ├── openclaw-adapter.js
│       ├── discord-profile.js
│       ├── state.json      # 游戏状态（运行时生成）
│       ├── package.json
│       └── .env
└── ...
```

---

## ✅ 验证清单

- [ ] Bot 已上线
- [ ] Slash 命令可用（`/awakening`, `/reset`）
- [ ] 按钮点击正常
- [ ] 文字输入响应正常
- [ ] 觉醒后昵称更新
- [ ] 觉醒后头像更新
- [ ] 角色扮演对话正常

---

## 🆘 获取帮助

- **GitHub Issues:** https://github.com/Yvelinmoon/discord-awaken-claw-new/issues
- **文档:** SKILL.md, README.md
- **日志:** `/tmp/openclaw/` 目录

---

**祝部署顺利！** 🦞
