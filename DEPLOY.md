# 🚀 部署指南

快速将龙虾宝宝觉醒技能部署到你的 OpenClaw Bot。

---

## 📋 前提条件

- ✅ Node.js 18+
- ✅ Discord Bot 及 Token
- ✅ OpenClaw 工作区
- ✅ Neta API Token（用于头像搜索）

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
pnpm install
# 或 npm install
```

这会安装：
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
DISCORD_GUILD_ID=你的服务器 ID
NETA_TOKEN=你的 Neta API Token
```

### 方法 B：直接在技能目录创建

```bash
cp .env.example .env
nano .env  # 或使用你喜欢的编辑器
```

---

## 🔧 步骤 4：集成到 OpenClaw

在 OpenClaw 主 agent 中导入并使用：

```javascript
const handler = require('./skills/awakening/direct-handler.js');

// 处理 Discord 消息
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

if (handled) {
  console.log('觉醒流程已处理');
}
```

---

## 🔧 步骤 5：测试觉醒

在 Discord 中：

1. **开始觉醒**
   ```
   /awakening
   ```
   或
   ```
   @Bot 开始觉醒
   ```

2. **点击按钮** - "◎ 我已想好"

3. **输入初始词** - 描述你心中的角色

4. **回答追问** - 2-3 轮问答

5. **确认觉醒** - 点击"◎ 就是他/她，请破壳"

---

## ✅ 验证清单

- [ ] 技能文件已克隆
- [ ] 依赖已安装
- [ ] 环境变量已配置
- [ ] 主 agent 已集成
- [ ] `/awakening` 命令可用
- [ ] 按钮交互正常
- [ ] 觉醒流程完整
- [ ] 昵称和头像更新成功
- [ ] 角色扮演正常

---

## 🐛 故障排除

### 问题 1：找不到 direct-handler.js

**检查文件是否存在：**
```bash
ls -la direct-handler.js
```

**解决方案：** 重新克隆仓库

---

### 问题 2：按钮无响应

**原因：** customId 格式不正确

**解决方案：** 确保按钮 customId 包含用户 ID：
```javascript
customId: `start_${userId}`
```

---

### 问题 3：头像更新失败

**原因：** 图片源不可访问

**解决方案：**
1. 使用 Neta API 搜索角色图片
2. 或让用户手动上传图片

---

### 问题 4：角色扮演不生效

**检查：**
```javascript
const game = getGame(userId);
console.log('觉醒状态:', game?.awakened);
console.log('角色数据:', game?.charData);
```

**解决方案：** 确保觉醒流程完整完成

---

## 📄 许可证

MIT License

---

**GitHub:** https://github.com/Yvelinmoon/discord-awaken-claw-new  
**作者:** Yves  
**更新日期:** 2026-03-11
