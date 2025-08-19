const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 创建HTTP服务器
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 存储房间连接的客户端
const roomClients = new Map(); // roomId -> Set of WebSocket connections

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection established');
  
  // 处理消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'joinRoom':
          // 用户加入房间
          const roomId = data.roomId;
          if (!roomClients.has(roomId)) {
            roomClients.set(roomId, new Set());
          }
          roomClients.get(roomId).add(ws);
          ws.roomId = roomId;
          console.log(`User joined room ${roomId}`);
          break;
          
        case 'leaveRoom':
          // 用户离开房间
          if (ws.roomId) {
            const room = roomClients.get(ws.roomId);
            if (room) {
              room.delete(ws);
              if (room.size === 0) {
                roomClients.delete(ws.roomId);
              }
            }
            delete ws.roomId;
          }
          break;
          
        case 'roomUpdate':
          // 房间状态更新，广播给房间内所有用户
          if (ws.roomId) {
            broadcastToRoom(ws.roomId, data);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  // 处理连接关闭
  ws.on('close', () => {
    // 清理房间连接
    if (ws.roomId) {
      const room = roomClients.get(ws.roomId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          roomClients.delete(ws.roomId);
        }
      }
    }
    console.log('WebSocket connection closed');
  });
  
  // 处理错误
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// 广播消息到房间内的所有客户端
function broadcastToRoom(roomId, message) {
  const room = roomClients.get(roomId);
  if (room) {
    const messageString = JSON.stringify(message);
    room.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }
}

// 中间件
app.use(cors());
app.use(express.json());

// 导入路由
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');

// 使用路由（在静态文件服务之前注册API路由）
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);

// 提供静态文件服务 - 使用game文件夹作为前端界面
app.use(express.static(path.join(__dirname, 'game')));

// MongoDB连接（如果失败不影响前端页面的访问）
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guessing-game';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.log('Failed to connect to MongoDB, but the server will still run for frontend access');
  console.error('MongoDB connection error:', err);
});

const db = mongoose.connection;

// 基础路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'index.html'));
});

// 管理员页面路由（已修改为指向game文件夹）
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'admin.html'));
});

// 游戏页面路由 - 保留原来的game.html以供兼容
app.get('/game.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// 登录页面路由
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'login.html'));
});

// 注册页面路由
app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'register.html'));
});

// 游戏相关页面路由
app.get('/rules.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'rules.html'));
});

app.get('/single-player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'single-player.html'));
});

app.get('/multiplayer.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'multiplayer.html'));
});

// 处理所有其他路由，返回首页（用于前端路由）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'game', 'index.html'));
});

// 启动服务器
const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server is also running on the same port`);
});

module.exports = { app, wss, broadcastToRoom }; // 导出以便在路由中使用
