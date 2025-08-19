const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room'); // 添加Room模型

const router = express.Router();

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

// 验证管理员权限中间件
const authorizeAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: '权限不足' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
};

// 获取所有用户
router.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // 不返回密码字段
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 删除用户
router.delete('/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // 不能删除自己
    if (userId === req.user.userId) {
      return res.status(400).json({ message: '不能删除自己的账户' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ message: '用户删除成功' });
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 获取所有房间
router.get('/rooms', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const rooms = await Room.find().populate('creator', 'username').populate('players.userId', 'username');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 删除房间
router.delete('/rooms/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const roomId = req.params.id;

    const room = await Room.findByIdAndDelete(roomId);
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    res.json({ message: '房间删除成功' });
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

// 修改房间信息
router.put('/rooms/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const roomId = req.params.id;
    const { name, isPublic, maxPlayers } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: '房间不存在' });
    }

    // 更新房间信息
    if (name !== undefined) room.name = name;
    if (isPublic !== undefined) room.isPublic = isPublic;
    if (maxPlayers !== undefined) room.maxPlayers = maxPlayers;

    await room.save();

    res.json({ message: '房间信息更新成功', room });
  } catch (error) {
    res.status(500).json({ message: '服务器错误', error: error.message });
  }
});

module.exports = router;