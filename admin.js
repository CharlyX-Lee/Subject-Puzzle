const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const path = require('path');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 导入路由
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

// 使用路由（在静态文件服务之前注册API路由）
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 提供静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/guessing-game';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB for admin panel');
}).catch(err => {
  console.log('Failed to connect to MongoDB for admin panel');
  console.error('MongoDB connection error:', err);
});

// 管理员页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 处理所有其他路由，返回管理员首页（用于前端路由）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 启动管理端服务器
const ADMIN_PORT = process.env.ADMIN_PORT || 5000;
app.listen(ADMIN_PORT, () => {
  console.log(`Admin panel is running on port ${ADMIN_PORT}`);
  console.log(`Visit http://localhost:${ADMIN_PORT} to access admin panel`);
});