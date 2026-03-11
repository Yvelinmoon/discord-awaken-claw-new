/**
 * Neta API 角色头像搜索
 * 
 * 调用 neta-skills 的 search_character_or_elementum 命令
 */

const https = require('https');

const NETA_TOKEN = process.env.NETA_TOKEN;
const NETA_API_BASE = process.env.NETA_API_BASE_URL || 'https://neta.talesofai.com';

/**
 * 搜索角色
 * @param {string} characterName - 角色名称
 * @param {string} from - 作品名称
 * @returns {Promise<{name: string, avatar: string, uuid: string}|null>}
 */
async function searchCharacter(characterName, from) {
  if (!NETA_TOKEN) {
    throw new Error('缺少 NETA_TOKEN 环境变量');
  }

  return new Promise((resolve, reject) => {
    // 使用 Neta API 搜索角色
    const query = encodeURIComponent(characterName);
    const url = `${NETA_API_BASE}/api/characters?search=${query}&limit=10`;
    
    console.log(`[Neta] 搜索角色：${characterName}`);
    console.log(`[Neta] URL: ${url}`);
    
    const options = {
      hostname: new URL(NETA_API_BASE).hostname,
      path: `/api/characters?search=${query}&limit=10`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NETA_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'OpenClaw-Bot/1.0',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.warn(`[Neta] API 返回错误：${res.statusCode}`, data);
            resolve(null);
            return;
          }
          
          // 查找匹配的角色
          const characters = result.data || result.characters || result || [];
          
          for (const char of characters) {
            const name = char.name || char.character_name || '';
            const avatar = char.avatar || char.image_url || char.avatar_url || '';
            
            // 检查是否匹配
            if (name.includes(characterName) || characterName.includes(name)) {
              console.log(`[Neta] ✅ 找到匹配角色：${name}`);
              resolve({
                name: name,
                avatar: avatar,
                uuid: char.uuid || char.id || '',
              });
              return;
            }
          }
          
          // 如果没有精确匹配，返回第一个结果
          if (characters.length > 0 && characters[0].avatar) {
            const first = characters[0];
            console.log(`[Neta] 使用第一个结果：${first.name || '未知'}`);
            resolve({
              name: first.name || characterName,
              avatar: first.avatar,
              uuid: first.uuid || first.id || '',
            });
            return;
          }
          
          console.log('[Neta] 未找到匹配的角色');
          resolve(null);
          
        } catch (e) {
          console.error('[Neta] 解析响应失败:', e.message);
          resolve(null);
        }
      });
    });

    req.on('error', err => {
      console.error('[Neta] 请求失败:', err.message);
      reject(err);
    });
    
    req.end();
  });
}

module.exports = {
  searchCharacter,
};
