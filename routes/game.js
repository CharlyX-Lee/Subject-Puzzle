const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const GameSession = require('../models/GameSession');
const Room = require('../models/Room'); // 添加Room模型
const fetch = require('node-fetch'); // 添加fetch用于调用Qwen API

const router = express.Router();

// 从server.js导入WebSocket广播函数
const serverModule = require('../server');
const broadcastToRoom = serverModule.broadcastToRoom;

// 验证token中间件
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: '无效的认证令牌' });
  }
};

// 调用Qwen API的函数
async function callQwenAPI(prompt) {
  try {
    const apiKey = process.env.QWEN_API_KEY;
    const apiEndpoint = process.env.QWEN_API_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    
    if (!apiKey) {
      throw new Error('QWEN_API_KEY not configured');
    }
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 0.8
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Qwen API call error:', error);
    throw error;
  }
}

// 开始新游戏
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { subject, level = 1, maxQuestions = 20, rounds = 1 } = req.body;
    const userId = req.user.userId;
    
    // 支持的学科
    const subjects = ['天文', '历史', '地理', '物理', '化学', '生物'];
    if (!subjects.includes(subject)) {
      return res.status(400).json({ message: '不支持的学科' });
    }

    // 调用Qwen大模型生成谜题
    const puzzle = await generateQwenPuzzle(subject, level);
    
    if (!puzzle || !puzzle.answer || !puzzle.hint || !puzzle.description) {
      return res.status(500).json({ message: '无法生成谜题' });
    }

    // 创建游戏会话
    const gameSession = new GameSession({
      userId,
      subject,
      level, // 添加关卡信息
      answer: puzzle.answer,
      hint: puzzle.hint,
      description: puzzle.description,
      maxQuestions: maxQuestions,
      rounds: rounds,
      currentRound: 1
    });

    await gameSession.save();

    res.json({
      sessionId: gameSession._id,
      subject: gameSession.subject,
      level: gameSession.level,
      description: gameSession.description,
      message: `谜题已生成！答案是与${subject}相关的术语。你最多可以提问${maxQuestions}次。`
    });
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 提问
router.post('/:sessionId/ask', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { question } = req.body;
    const userId = req.user.userId;

    if (!question) {
      return res.status(400).json({ message: '问题不能为空' });
    }

    // 查找游戏会话
    const gameSession = await GameSession.findById(sessionId);
    if (!gameSession) {
      return res.status(404).json({ message: '游戏会话不存在' });
    }

    if (gameSession.userId.toString() !== userId) {
      return res.status(403).json({ message: '无权访问此游戏会话' });
    }

    if (gameSession.isCompleted) {
      return res.status(400).json({ message: '游戏已结束' });
    }

    // 检查是否超过最大提问次数
    if (gameSession.questions.length >= gameSession.maxQuestions) {
      return res.status(400).json({ message: `已达到最大提问次数限制 (${gameSession.maxQuestions}次)` });
    }

    // 调用Qwen API来获取答案
    const answer = await getQwenAnswer(gameSession, question);

    // 保存问题和答案
    gameSession.questions.push({ question, answer });

    // 检查是否猜中答案
    if (question.toLowerCase() === gameSession.answer.toLowerCase()) {
      gameSession.isCompleted = true;
      gameSession.isWon = true;
      
      // 计算得分 (基于问题数量，最多20次提问)
      const maxQuestions = gameSession.maxQuestions;
      const questionsUsed = gameSession.questions.length;
      const score = Math.max(100 - Math.floor((questionsUsed - 1) * 100 / maxQuestions), 10);
      gameSession.score = score;
      
      // 更新用户得分和记录
      const user = await User.findById(userId);
      if (user) {
        user.score += score;
        user.gamesPlayed += 1;
        user.gamesWon += 1;
        
        // 更新用户记录
        if (user.minQuestionsRecord === null || questionsUsed < user.minQuestionsRecord) {
          user.minQuestionsRecord = questionsUsed;
        }
        
        // 注意：时间记录需要前端传递，因为计时在前端进行
        await user.save();
      }
    } else if (gameSession.questions.length >= gameSession.maxQuestions) {
      // 限制最多提问次数
      gameSession.isCompleted = true;
      
      // 更新用户游戏次数
      const user = await User.findById(userId);
      if (user) {
        user.gamesPlayed += 1;
        await user.save();
      }
    }

    await gameSession.save();

    res.json({
      answer,
      isCorrect: question.toLowerCase() === gameSession.answer.toLowerCase(),
      isCompleted: gameSession.isCompleted,
      questionsLeft: gameSession.maxQuestions - gameSession.questions.length
    });
  } catch (error) {
    console.error('Ask question error:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 获取提示
router.post('/hint/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    // 查找游戏会话
    const gameSession = await GameSession.findById(sessionId);
    if (!gameSession) {
      return res.status(404).json({ message: '游戏会话不存在' });
    }

    if (gameSession.userId.toString() !== userId) {
      return res.status(403).json({ message: '无权访问此游戏会话' });
    }

    if (gameSession.isCompleted) {
      return res.status(400).json({ message: '游戏已结束' });
    }

    // 检查是否已经获取过提示
    if (gameSession.hintRequested) {
      return res.status(400).json({ message: '每场游戏只能获取一次提示' });
    }

    // 调用Qwen API获取提示
    const hint = await getQwenHint(gameSession);
    
    gameSession.hintRequested = true;
    gameSession.hint = hint; // 更新提示内容
    await gameSession.save();

    res.json({ hint: gameSession.hint });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 获取游戏状态
router.get('/status/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    // 查找游戏会话
    const gameSession = await GameSession.findById(sessionId);
    if (!gameSession) {
      return res.status(404).json({ message: '游戏会话不存在' });
    }

    if (gameSession.userId.toString() !== userId) {
      return res.status(403).json({ message: '无权访问此游戏会话' });
    }

    // 同时获取用户信息，包括记录
    const user = await User.findById(userId);

    res.json({
      subject: gameSession.subject,
      level: gameSession.level, // 添加关卡信息
      description: gameSession.description, // 添加汤面描述
      questions: gameSession.questions,
      hint: gameSession.hint,
      hintRequested: gameSession.hintRequested,
      isCompleted: gameSession.isCompleted,
      isWon: gameSession.isWon,
      score: gameSession.score,
      maxQuestions: gameSession.maxQuestions,
      rounds: gameSession.rounds,
      currentRound: gameSession.currentRound,
      userRecords: {
        minQuestions: user.minQuestionsRecord,
        fastestTime: user.fastestTimeRecord
      }
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 获取用户记录
router.get('/user/records', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    res.json({
      minQuestions: user.minQuestionsRecord,
      fastestTime: user.fastestTimeRecord
    });
  } catch (error) {
    console.error('Get user records error:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 更新用户时间记录
router.put('/user/records/time', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { time } = req.body; // 时间以秒为单位
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    // 只有时间更快时才更新记录
    if (user.fastestTimeRecord === null || time < user.fastestTimeRecord) {
      user.fastestTimeRecord = time;
      await user.save();
    }
    
    res.json({ 
      message: '记录更新成功',
      fastestTime: user.fastestTimeRecord
    });
  } catch (error) {
    console.error('Update user time record error:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 创建房间
router.post('/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, isPublic = true, maxPlayers = 5 } = req.body;
    const userId = req.user.userId;

    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 检查房间名称是否已存在
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ message: '房间名称已存在' });
    }

    // 创建房间
    const room = new Room({
      name,
      creator: userId,
      players: [{
        userId,
        username: user.username,
        isReady: false,
        isCreator: true
      }],
      maxPlayers,
      isPublic
    });

    await room.save();

    // 填充玩家信息
    await room.populate('players.userId', 'username');

    res.status(201).json({
      message: '房间创建成功',
      room
    });
  } catch (error) {
    console.error('创建房间失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 加入房间
router.post('/rooms/:roomId/join', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    // 查找用户
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 查找房间
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 检查房间是否已满
    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ message: '房间已满' });
    }

    // 检查用户是否已在房间中
    const playerExists = room.players.some(player => player.userId.toString() === userId);
    if (playerExists) {
      return res.status(400).json({ message: '您已在房间中' });
    }

    // 添加用户到房间
    room.players.push({
      userId,
      username: user.username,
      isReady: false,
      isCreator: false
    });

    await room.save();

    // 填充玩家信息
    await room.populate('players.userId', 'username');

    // 通过WebSocket广播房间更新
    if (typeof broadcastToRoom === 'function') {
      broadcastToRoom(roomId, {
        type: 'roomUpdate',
        action: 'playerJoined',
        player: {
          userId,
          username: user.username,
          isReady: false,
          isCreator: false
        },
        room: room
      });
    }

    res.json({
      message: '成功加入房间',
      room
    });
  } catch (error) {
    console.error('加入房间失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 通过房间名称加入房间
router.post('/rooms/join', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    // 检查用户是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 查找房间
    const room = await Room.findOne({ name });
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 检查房间是否已满
    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ message: '房间已满' });
    }

    // 检查用户是否已在房间中
    const playerExists = room.players.some(player => player.userId.toString() === userId);
    if (playerExists) {
      return res.status(400).json({ message: '您已在房间中' });
    }

    // 添加用户到房间
    room.players.push({
      userId,
      username: user.username,
      isReady: false,
      isCreator: false
    });

    await room.save();

    // 填充玩家信息
    await room.populate('players.userId', 'username');

    res.json({
      message: '成功加入房间',
      room
    });
  } catch (error) {
    console.error('加入房间失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 获取房间信息
router.get('/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    // 查找房间并填充玩家信息
    const room = await Room.findById(roomId).populate('players.userId', 'username');
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    res.json({
      room
    });
  } catch (error) {
    console.error('获取房间信息失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 获取房间信息（通过房间名称）
router.get('/rooms/name/:roomName', authenticateToken, async (req, res) => {
  try {
    const { roomName } = req.params;

    // 查找房间并填充玩家信息
    const room = await Room.findOne({ name: roomName }).populate('players.userId', 'username');
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    res.json({
      room
    });
  } catch (error) {
    console.error('获取房间信息失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 玩家准备/取消准备
router.patch('/rooms/:roomId/players/:playerId/ready', authenticateToken, async (req, res) => {
  try {
    const { roomId, playerId } = req.params;
    const { isReady } = req.body;
    const userId = req.user.userId;

    // 查找房间
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 查找玩家
    const player = room.players.id(playerId);
    if (!player) {
      return res.status(404).json({ message: '玩家不存在' });
    }

    // 验证玩家是否为当前用户（除非是房主）
    const isRoomCreator = room.creator.toString() === userId;
    if (player.userId.toString() !== userId && !isRoomCreator) {
      return res.status(403).json({ message: '无权限修改其他玩家状态' });
    }

    // 更新准备状态
    player.isReady = isReady;

    await room.save();

    // 填充玩家信息
    await room.populate('players.userId', 'username');

    // 通过WebSocket广播房间更新
    if (typeof broadcastToRoom === 'function') {
      broadcastToRoom(roomId, {
        type: 'roomUpdate',
        action: 'playerReadyStatusChanged',
        playerId: playerId,
        isReady: isReady,
        room: room
      });
    }

    res.json({
      message: `玩家${isReady ? '已准备' : '取消准备'}`,
      room
    });
  } catch (error) {
    console.error('更新玩家准备状态失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 离开房间
router.delete('/rooms/:roomId/players/:playerId', authenticateToken, async (req, res) => {
  try {
    const { roomId, playerId } = req.params;
    const userId = req.user.userId;

    // 查找房间
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 查找玩家
    const player = room.players.id(playerId);
    if (!player) {
      return res.status(404).json({ message: '玩家不存在' });
    }

    // 验证玩家是否为当前用户（除非是房主）
    const isRoomCreator = room.creator.toString() === userId;
    if (player.userId.toString() !== userId && !isRoomCreator) {
      return res.status(403).json({ message: '无权限移除其他玩家' });
    }

    // 如果房主离开，转让房主权限给下一个玩家
    if (player.isCreator && room.players.length > 1) {
      const nextPlayer = room.players.find(p => p.id !== playerId);
      if (nextPlayer) {
        nextPlayer.isCreator = true;
      }
    }

    // 移除玩家
    player.remove();

    let roomDeleted = false;
    // 如果房间为空，删除房间
    if (room.players.length === 0) {
      await Room.findByIdAndDelete(roomId);
      roomDeleted = true;
    } else {
      await room.save();
      
      // 填充玩家信息
      await room.populate('players.userId', 'username');
    }

    // 通过WebSocket广播房间更新
    if (typeof broadcastToRoom === 'function' && !roomDeleted) {
      broadcastToRoom(roomId, {
        type: 'roomUpdate',
        action: 'playerLeft',
        playerId: playerId,
        room: room
      });
    }

    res.json({
      message: '您已离开房间',
      room: roomDeleted ? null : room
    });
  } catch (error) {
    console.error('离开房间失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 开始游戏
router.post('/rooms/:roomId/start', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    // 查找房间
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 验证是否为房主
    if (room.creator.toString() !== userId) {
      return res.status(403).json({ message: '只有房主可以开始游戏' });
    }

    // 检查是否有至少2个玩家
    if (room.players.length < 2) {
      return res.status(400).json({ message: '至少需要2个玩家才能开始游戏' });
    }

    // 检查所有玩家是否已准备
    const allReady = room.players.every(player => player.isReady);
    if (!allReady) {
      return res.status(400).json({ message: '所有玩家必须准备后才能开始游戏' });
    }

    // 更新房间状态
    room.status = 'playing';
    room.startedAt = new Date();

    await room.save();

    res.json({
      message: '游戏开始',
      room
    });
  } catch (error) {
    console.error('开始游戏失败:', error);
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 改进的Qwen提示函数
async function getQwenHint(gameSession) {
  try {
    if (!gameSession.answer) {
      return '请先开始游戏再获取提示';
    }
    
    // 构造提示词，要求为谜题提供提示
    const prompt = `你正在参与一个"${gameSession.subject}"学科的海龟汤游戏。
    
请为这个谜题提供一个简洁但有启发性的提示，帮助玩家推理出答案。
要求：
1. 提示不能直接透露答案
2. 提示应该与学科相关
3. 提示应该有助于玩家缩小答案范围
4. 提示应该简洁明了，不超过20个字

游戏信息：
- 谜底：${gameSession.answer}
- 汤面描述：${gameSession.description}

请给出你的提示：`;

    // 调用真实的Qwen API
    try {
      const response = await callQwenAPI(prompt);
      // 清理响应内容
      let cleanResponse = response.trim();
      
      // 如果响应以"提示："开头，去掉前缀
      if (cleanResponse.startsWith('提示：')) {
        cleanResponse = cleanResponse.substring(3);
      }
      
      // 确保提示不会太长
      if (cleanResponse.length > 50) {
        cleanResponse = cleanResponse.substring(0, 50) + '...';
      }
      
      return cleanResponse || '提示：答案与' + gameSession.subject + '相关';
    } catch (apiError) {
      console.error('Qwen API call failed:', apiError);
    }
    
    // 如果API调用失败，使用本地提示
    console.log('Using fallback hint logic');
    
    // 根据答案提供更有针对性的提示
    const answer = gameSession.answer;
    const subject = gameSession.subject;
    
    // 学科特定提示
    const subjectHints = {
      '天文': {
        '黑洞': '宇宙中引力极强的天体，连光都无法逃脱',
        '彗星': '拖着长尾巴的太阳系小天体',
        '银河系': '包含太阳系的棒旋星系'
      },
      '历史': {
        '丝绸之路': '古代连接东西方的重要商贸通道',
        '工业革命': '18世纪开始的机械化生产变革',
        '万里长城': '中国古代修建的军事防御工程'
      },
      '地理': {
        '亚马逊雨林': '地球上最大的热带雨林',
        '死海': '世界上最低的湖泊，含盐度极高',
        '喜马拉雅山': '世界上最高的山脉'
      },
      '物理': {
        '相对论': '爱因斯坦提出的时空理论',
        '量子': '物理量的最小单位',
        '光速': '物理学中最快的速度'
      },
      '化学': {
        '催化剂': '能改变化学反应速率但本身不被消耗的物质',
        '元素周期表': '按原子序数排列化学元素的表格',
        '酸雨': 'pH值小于5.6的降水'
      },
      '生物': {
        '光合作用': '植物利用阳光制造有机物的过程',
        '基因': '决定生物性状的遗传基本单位',
        '生态系统': '生物群落与其环境的统一整体'
      }
    };
    
    // 查找学科和答案对应的提示
    if (subjectHints[subject] && subjectHints[subject][answer]) {
      return subjectHints[subject][answer];
    }
    
    // 默认提示
    return `答案与${gameSession.subject}相关，是一个${answer.length}个字的${gameSession.subject}术语`;
  } catch (error) {
    console.error('Qwen hint generation error:', error);
    return '抱歉，暂时无法提供提示。';
  }
}

// 改进的Qwen回答函数
async function getQwenAnswer(gameSession, question) {
  try {
    // 检查问题是否是猜测答案
    if (question.toLowerCase() === gameSession.answer.toLowerCase()) {
      return '恭喜你，答对了！';
    }

    // 构造提示词，要求根据问题和答案给出合理的回答
    const prompt = `你正在参与一个"${gameSession.subject}"学科的海龟汤游戏。
    
游戏规则：
1. 玩家通过提问来猜测谜底
2. 你只能回答"是"、"不是"、"可能是"、"不确定"等简短回答
3. 回答必须与谜底和问题相关
4. 不要直接透露谜底
5. 回答应有助于玩家推理出谜底

当前游戏信息：
- 谜底：${gameSession.answer}
- 汤面描述：${gameSession.description}
- 玩家提问：${question}

请根据以上信息给出你的回答：`;

    // 调用真实的Qwen API
    try {
      const response = await callQwenAPI(prompt);
      // 清理响应，确保只返回简短回答
      let cleanResponse = response.trim();
      
      // 如果响应太长，只取第一句
      if (cleanResponse.includes('。')) {
        cleanResponse = cleanResponse.split('。')[0] + '。';
      }
      
      // 确保回答符合要求的格式
      const validResponses = ['是', '不是', '可能是', '不确定', '这个问题与答案无关'];
      if (validResponses.includes(cleanResponse)) {
        return cleanResponse;
      }
      
      // 如果API返回了详细的回答，提取关键词
      const lowerResponse = cleanResponse.toLowerCase();
      if (lowerResponse.includes('是') && !lowerResponse.includes('不是')) {
        return '是';
      } else if (lowerResponse.includes('不是')) {
        return '不是';
      } else {
        // 返回原始响应或默认响应
        return cleanResponse.length > 20 ? '可能是' : cleanResponse;
      }
    } catch (apiError) {
      console.error('Qwen API call failed:', apiError);
    }
    
    // 如果API调用失败，使用本地逻辑
    console.log('Using fallback answer logic');
    
    // 根据具体问题和答案生成更合理的回答
    const answer = gameSession.answer.toLowerCase();
    const subject = gameSession.subject;
    
    // 使用学科题目库中的题目进行更精确的回答
    const subjectPuzzles = {
      '天文': [
        { 
          answer: '黑洞', 
          responses: {
            '光': '不是',
            '引力': '是',
            '逃逸': '不是',
            '星': '可能是'
          }
        },
        { 
          answer: '彗星', 
          responses: {
            '尾巴': '是',
            '太阳': '是',
            '冰': '是',
            '岩石': '可能是'
          }
        },
        { 
          answer: '银河系', 
          responses: {
            '星系': '是',
            '太阳': '是',
            '恒星': '是',
            '地球': '是'
          }
        }
      ],
      '历史': [
        { 
          answer: '丝绸之路', 
          responses: {
            '贸易': '是',
            '中国': '是',
            '骆驼': '可能是',
            '唐朝': '可能是'
          }
        },
        { 
          answer: '工业革命', 
          responses: {
            '机器': '是',
            '工厂': '是',
            '蒸汽': '是',
            '英国': '是'
          }
        },
        { 
          answer: '万里长城', 
          responses: {
            '中国': '是',
            '防御': '是',
            '建筑': '是',
            '明朝': '可能是'
          }
        }
      ],
      '地理': [
        { 
          answer: '亚马逊雨林', 
          responses: {
            '森林': '是',
            '巴西': '是',
            '氧气': '是',
            '动物': '是'
          }
        },
        { 
          answer: '死海', 
          responses: {
            '盐': '是',
            '漂浮': '是',
            '最低': '是',
            '约旦': '可能是'
          }
        },
        { 
          answer: '喜马拉雅山', 
          responses: {
            '高': '是',
            '珠峰': '是',
            '亚洲': '是',
            '雪': '可能是'
          }
        }
      ],
      '物理': [
        { 
          answer: '相对论', 
          responses: {
            '时空': '是',
            '爱因斯坦': '是',
            '光速': '是',
            '质量': '是'
          }
        },
        { 
          answer: '量子', 
          responses: {
            '微观': '是',
            '粒子': '是',
            '分割': '不是',
            '能量': '是'
          }
        },
        { 
          answer: '光速', 
          responses: {
            '快': '是',
            '极限': '是',
            '电磁波': '是',
            '30万': '是'
          }
        }
      ],
      '化学': [
        { 
          answer: '催化剂', 
          responses: {
            '反应': '是',
            '消耗': '不是',
            '速度': '是',
            '酶': '可能是'
          }
        },
        { 
          answer: '元素周期表', 
          responses: {
            '门捷列夫': '是',
            '原子': '是',
            '排列': '是',
            '化学': '是'
          }
        },
        { 
          answer: '酸雨', 
          responses: {
            'pH': '是',
            '污染': '是',
            '二氧化硫': '是',
            '环境': '是'
          }
        }
      ],
      '生物': [
        { 
          answer: '光合作用', 
          responses: {
            '植物': '是',
            '阳光': '是',
            '氧气': '是',
            '叶绿素': '可能是'
          }
        },
        { 
          answer: '基因', 
          responses: {
            '遗传': '是',
            'DNA': '是',
            '性状': '是',
            '染色体': '可能是'
          }
        },
        { 
          answer: '生态系统', 
          responses: {
            '环境': '是',
            '生物': '是',
            '平衡': '是',
            '食物链': '可能是'
          }
        }
      ]
    };
    
    // 处理是非问题
    if (question.includes("是不是") || question.includes("是") || question.includes("不是")) {
      // 查找匹配的答案和响应
      const subjectData = subjectPuzzles[subject] || [];
      const puzzleData = subjectData.find(p => p.answer.toLowerCase() === answer);
      
      if (puzzleData && puzzleData.responses) {
        // 查找匹配的关键词
        for (const [keyword, response] of Object.entries(puzzleData.responses)) {
          if (question.includes(keyword)) {
            return response;
          }
        }
      }
      
      // 如果没有匹配上，给出一个通用回答
      const responses = ['是', '不是', '可能是', '不确定'];
      return responses[Math.floor(Math.random() * responses.length)];
    } else {
      // 对于其他类型问题，给出提示性回答
      const subjectData = subjectPuzzles[subject] || [];
      const puzzleData = subjectData.find(p => p.answer.toLowerCase() === answer);
      
      if (puzzleData) {
        // 根据问题关键词给出相关提示
        if (answer.includes('黑洞')) {
          if (question.includes('大小') || question.includes('质量')) {
            return '黑洞的质量非常大';
          } else if (question.includes('发现') || question.includes('观测')) {
            return '黑洞很难直接观测到';
          }
        } else if (answer.includes('彗星')) {
          if (question.includes('轨道') || question.includes('太阳')) {
            return '彗星绕太阳运行';
          } else if (question.includes('尾巴') || question.includes('气体')) {
            return '彗星接近太阳时会产生尾巴';
          }
        } else if (answer.includes('银河系')) {
          if (question.includes('大小') || question.includes('规模')) {
            return '银河系包含数千亿颗恒星';
          } else if (question.includes('太阳')) {
            return '太阳是银河系中的一颗恒星';
          }
        } else if (answer.includes('光合作用')) {
          if (question.includes('条件') || question.includes('需要')) {
            return '光合作用需要阳光、二氧化碳和水';
          } else if (question.includes('产物') || question.includes('产生')) {
            return '光合作用产生氧气和有机物';
          }
        } else if (answer.includes('基因')) {
          if (question.includes('位置') || question.includes('存在')) {
            return '基因存在于DNA上';
          } else if (question.includes('功能') || question.includes('作用')) {
            return '基因决定生物的性状';
          }
        }
      }
      
      // 如果没有特定匹配，给出通用回答
      const responses = ['是', '不是', '可能是', '不确定', '部分正确', '这个问题需要更具体的思考'];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  } catch (error) {
    console.error('Qwen answer generation error:', error);
    return '抱歉，我无法回答这个问题。';
  }
}

// 调用真实Qwen API的函数（需要配置API密钥）
/*
async function callQwenAPI(prompt) {
  try {
    const apiKey = process.env.QWEN_API_KEY;
    const apiEndpoint = process.env.QWEN_API_ENDPOINT || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    
    if (!apiKey) {
      throw new Error('QWEN_API_KEY not configured');
    }
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'enable'
      },
      body: JSON.stringify({
        model: 'qwen3',
        input: {
          prompt: prompt
        },
        parameters: {
          max_tokens: 200,
          temperature: 0.7,
          top_p: 0.8
        }
      })
    });
    
    const data = await response.json();
    return data.output.text;
  } catch (error) {
    console.error('Qwen API call error:', error);
    throw error;
  }
}
*/

// 调用Qwen大模型生成谜题的函数
async function generateQwenPuzzle(subject, level = 1) {
  try {
    // 构造提示词，要求生成特定学科的海龟汤谜题
    const prompt = `你是一名学科知识专家，正在参与"学科海龟汤"游戏。请根据以下要求生成游戏内容：

学科：${subject}
关卡：${level}
关卡类型：方程式

要求：
1. 从${subject}学科中选择一个适合第${level}关的谜底（术语或概念，3-10个字符）
2. 生成对应的汤面描述（线索）
3. 确保谜底与汤面逻辑一致
4. 谜底必须是真实存在的${subject}知识
5. 提供一个简洁但有启发性的提示

请按以下JSON格式返回：
{
  "answer": "谜底（如：光合作用）",
  "soup": "汤面描述（如：绿色植物在阳光下将二氧化碳和水转化为有机物的过程）",
  "hint": "提示（如：这是植物特有的生理过程）",
  "explanation": "谜底与汤面关系的简要说明"
}`;

    // 调用真实的Qwen API
    try {
      const response = await callQwenAPI(prompt);
      
      // 清理响应内容，提取JSON部分
      let cleanResponse = response.trim();
      
      // 如果响应包含代码块标记，提取其中的JSON
      if (cleanResponse.startsWith('``json')) {
        cleanResponse = cleanResponse.substring(7);
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.substring(3);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3);
      }
      
      // 解析返回的JSON
      const puzzle = JSON.parse(cleanResponse);
      
      if (puzzle.answer && puzzle.soup && puzzle.hint) {
        return {
          answer: puzzle.answer,
          hint: puzzle.hint,
          description: puzzle.soup
        };
      }
    } catch (apiError) {
      console.error('Qwen API call failed:', apiError);
    }
    
    // 如果API调用失败，回退到模拟数据
    console.log('Using fallback puzzle data');
    
    // 学科题目库
    const subjectPuzzles = {
      '天文': [
        { 
          answer: '黑洞', 
          hint: '宇宙中引力极强的天体，连光都无法逃脱',
          description: '这是一种宇宙中极端密集的天体，引力强大到连光都无法逃脱。它们通常由大质量恒星坍缩形成，是宇宙中最神秘的天体之一。'
        },
        { 
          answer: '彗星', 
          hint: '拖着长尾巴的太阳系小天体',
          description: '这是一种太阳系小天体，当它接近太阳时会形成可见的彗发和彗尾。它们来自太阳系边缘的奥尔特云，携带着太阳系形成初期的信息。'
        },
        { 
          answer: '银河系', 
          hint: '包含太阳系的棒旋星系',
          description: '这是我们所在的星系，包含数千亿颗恒星，太阳是其中之一。它是一个巨大的棒旋星系，直径约10万光年。'
        }
      ],
      '历史': [
        { 
          answer: '丝绸之路', 
          hint: '古代连接东西方的重要商贸通道',
          description: '这是一条古代重要的贸易路线，连接了东西方文明，促进了经济和文化交流。它不仅是商贸之路，更是文化、宗教和技术交流的桥梁。'
        },
        { 
          answer: '工业革命', 
          hint: '18世纪开始的机械化生产变革',
          description: '这是18世纪中后期开始于英国的生产技术和社会经济变革，标志着人类从农业社会向工业社会的转变。它彻底改变了人类的生产方式和生活方式。'
        },
        { 
          answer: '万里长城', 
          hint: '中国古代修建的军事防御工程',
          description: '这是中国古代修建的军事防御工程，总长度超过两万公里，是世界文化遗产。它见证了中国古代的历史变迁，是中华民族的象征之一。'
        }
      ],
      '地理': [
        { 
          answer: '亚马逊雨林', 
          hint: '地球上最大的热带雨林',
          description: '这是地球上最大的热带雨林，被誉为"地球之肺"，拥有极其丰富的生物多样性。它对全球气候调节和氧气产生起着重要作用。'
        },
        { 
          answer: '死海', 
          hint: '世界上最低的湖泊，含盐度极高',
          description: '这是世界上最低的湖泊，湖面海拔约为-430米，含盐度极高，人可以轻松地在上面漂浮。它的独特环境造就了特殊的生态系统。'
        },
        { 
          answer: '喜马拉雅山', 
          hint: '世界上最高的山脉',
          description: '这是世界上最高大的山脉，包含多座海拔超过8000米的高峰，其中包括世界最高峰珠穆朗玛峰。它是印度板块和欧亚板块碰撞的产物。'
        }
      ],
      '物理': [
        { 
          answer: '相对论', 
          hint: '爱因斯坦提出的时空理论',
          description: '这是爱因斯坦提出的著名理论，包括狭义相对论和广义相对论，改变了人们对时间、空间和引力的认识。它揭示了时空的相对性和弯曲性。'
        },
        { 
          answer: '量子', 
          hint: '物理量的最小单位',
          description: '这是物理量的最小单位，不能被进一步分割。量子力学就是研究这种微观粒子行为的物理学分支，揭示了微观世界的奇特规律。'
        },
        { 
          answer: '光速', 
          hint: '物理学中最快的速度',
          description: '这是物理学中的一个基本常数，是电磁波在真空中的传播速度，数值约为每秒299,792,458米。它是宇宙中信息传播的速度极限。'
        }
      ],
      '化学': [
        { 
          answer: '催化剂', 
          hint: '能改变化学反应速率但本身不被消耗的物质',
          description: '这是一种能改变化学反应速率但在反应前后质量和化学性质都不改变的物质。它在工业生产和生物体内起着至关重要的作用。'
        },
        { 
          answer: '元素周期表', 
          hint: '按原子序数排列化学元素的表格',
          description: '这是化学中最重要的工具之一，由门捷列夫发现，按原子序数递增的顺序排列所有化学元素。它揭示了元素性质的周期性规律。'
        },
        { 
          answer: '酸雨', 
          hint: 'pH值小于5.6的降水',
          description: '这是一种环境问题，指pH值小于5.6的酸性降水，主要由二氧化硫和氮氧化物造成。它对生态系统和建筑物都有腐蚀作用。'
        }
      ],
      '生物': [
        { 
          answer: '光合作用', 
          hint: '植物利用阳光制造有机物的过程',
          description: '这是绿色植物在阳光照射下，将二氧化碳和水转化为有机物并释放氧气的过程。它是地球上生命能量来源的基础，维持着大气中氧气和二氧化碳的平衡。'
        },
        { 
          answer: '基因', 
          hint: '决定生物性状的遗传基本单位',
          description: '这是遗传的基本单位，能够决定生物的性状，通过复制将遗传信息传递给下一代。它位于染色体上，由DNA序列组成。'
        },
        { 
          answer: '生态系统', 
          hint: '生物群落与其环境的统一整体',
          description: '这是生物群落与其生存环境形成的统一整体，包括生物和非生物成分。它具有能量流动和物质循环的功能，维持着自然界的平衡。'
        }
      ]
    };

    // 从样本中随机选择一个谜题
    const puzzles = subjectPuzzles[subject];
    if (puzzles && puzzles.length > 0) {
      return puzzles[Math.floor(Math.random() * puzzles.length)];
    }

    // 如果没有样本数据，返回默认谜题
    return {
      answer: '地球',
      hint: '这颗行星上有生命存在',
      description: '这是我们居住的行星，是太阳系中唯一已知存在生命的天体，拥有海洋、大陆和大气层。'
    };
  } catch (error) {
    console.error('Generate puzzle error:', error);
    return null;
  }
}

module.exports = router;