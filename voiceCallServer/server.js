require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Agora credentials from environment variables
const AGORA_APP_ID = process.env.AGORA_APP_ID || 'a965ccc621f341f98a5f67f70879807a';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '4bb043e2448e456e885cb9445c093f2a';
const TOKEN_EXPIRY = parseInt(process.env.TOKEN_EXPIRY || '3600');

// In-memory хранилище (в продакшене использовать MongoDB/Redis)
const users = new Map(); // userId -> user data
const activeCalls = new Map(); // callId -> call data
const userSockets = new Map(); // userId -> socket.id

// Генерация токена Agora
const generateToken = (channelName, uid = 0) => {
  const currentTime = Math.floor(Date.now() / 1000);
  const expireTime = currentTime + TOKEN_EXPIRY;
  
  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireTime
  );
  
  return token;
};

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Регистрация пользователя
app.post('/api/users/register', (req, res) => {
  const { name, deviceId } = req.body;
  
  if (!name || !deviceId) {
    return res.status(400).json({ error: 'Name and deviceId required' });
  }
  
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const user = {
    id: userId,
    name,
    deviceId,
    isOnline: false,
    createdAt: new Date(),
  };
  
  users.set(userId, user);
  console.log(`[API] User registered: ${user.name} (${userId})`);
  
  res.json(user);
});

// Получить список пользователей
app.get('/api/users', (req, res) => {
  const usersList = Array.from(users.values()).map(user => ({
    id: user.id,
    name: user.name,
    isOnline: user.isOnline,
  }));
  res.json(usersList);
});

// Получить информацию о пользователе
app.get('/api/users/:userId', (req, res) => {
  const { userId } = req.params;
  const user = users.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    id: user.id,
    name: user.name,
    isOnline: user.isOnline,
  });
});

// Получить токен для канала
app.post('/api/token', (req, res) => {
  const { channelName, uid } = req.body;
  
  if (!channelName) {
    return res.status(400).json({ error: 'channelName required' });
  }
  
  const token = generateToken(channelName, uid || 0);
  
  res.json({
    token,
    appId: AGORA_APP_ID,
    channelName,
    uid: uid || 0,
    expireTime: TOKEN_EXPIRY,
  });
});

// WebSocket подключения
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  // Авторизация пользователя
  socket.on('auth', (data) => {
    const { userId } = data;
    
    if (!userId || !users.has(userId)) {
      socket.emit('auth:error', { message: 'Invalid userId' });
      return;
    }
    
    // Обновляем статус пользователя
    const user = users.get(userId);
    user.isOnline = true;
    users.set(userId, user);
    userSockets.set(userId, socket.id);
    
    // Привязываем socket к userId
    socket.userId = userId;
    socket.join(`user:${userId}`);
    
    console.log(`[Socket] User authenticated: ${user.name} (${userId})`);
    
    // Уведомляем остальных об онлайне пользователя
    socket.broadcast.emit('user:online', {
      userId,
      name: user.name,
    });
    
    // Отправляем список онлайн пользователей
    const onlineUsers = Array.from(users.values())
      .filter(u => u.isOnline && u.id !== userId)
      .map(u => ({ id: u.id, name: u.name }));
    
    socket.emit('users:list', onlineUsers);
    socket.emit('auth:success', { userId });
  });
  
  // Инициация звонка
  socket.on('call:initiate', async (data) => {
    const { toUserId, fromUserId } = data;
    
    if (!socket.userId || socket.userId !== fromUserId) {
      socket.emit('call:error', { message: 'Unauthorized' });
      return;
    }
    
    if (!users.has(toUserId)) {
      socket.emit('call:error', { message: 'User not found' });
      return;
    }
    
    const toUser = users.get(toUserId);
    const fromUser = users.get(socket.userId);
    
    // Проверяем, онлайн ли пользователь
    if (!toUser.isOnline) {
      socket.emit('call:error', { message: 'User is offline' });
      return;
    }
    
    // Генерируем уникальный ID звонка и канал
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const channelName = `voice_channel_${callId}`;
    
    // Создаем запись звонка
    const call = {
      id: callId,
      channelName,
      fromUserId,
      toUserId,
      status: 'ringing',
      createdAt: new Date(),
    };
    activeCalls.set(callId, call);
    
    console.log(`[Call] Initiating: ${fromUser.name} -> ${toUser.name} (${callId})`);
    
    // Отправляем токен звонящему
    const token = generateToken(channelName);
    socket.emit('call:initiated', {
      callId,
      channelName,
      toUser: { id: toUser.id, name: toUser.name },
      token,
      appId: AGORA_APP_ID,
    });
    
    // Отправляем входящий звонок получателю
    const toSocketId = userSockets.get(toUserId);
    if (toSocketId) {
      io.to(toSocketId).emit('call:incoming', {
        callId,
        channelName,
        fromUser: { id: fromUser.id, name: fromUser.name },
        token,
        appId: AGORA_APP_ID,
      });
    }
  });
  
  // Принятие звонка
  socket.on('call:accept', (data) => {
    const { callId } = data;
    
    if (!socket.userId) {
      socket.emit('call:error', { message: 'Unauthorized' });
      return;
    }
    
    const call = activeCalls.get(callId);
    if (!call) {
      socket.emit('call:error', { message: 'Call not found' });
      return;
    }
    
    // Проверяем, что звонок адресован этому пользователю
    if (call.toUserId !== socket.userId) {
      socket.emit('call:error', { message: 'Not your call' });
      return;
    }
    
    call.status = 'active';
    activeCalls.set(callId, call);
    
    const callerSocketId = userSockets.get(call.fromUserId);
    const receiverSocketId = userSockets.get(call.toUserId);
    
    console.log(`[Call] Accepted: ${callId}`);
    
    // Уведомляем обоих пользователей
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:accepted', { callId });
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call:accepted', { callId });
    }
  });
  
  // Отклонение звонка
  socket.on('call:decline', (data) => {
    const { callId } = data;
    
    if (!socket.userId) {
      socket.emit('call:error', { message: 'Unauthorized' });
      return;
    }
    
    const call = activeCalls.get(callId);
    if (!call) {
      socket.emit('call:error', { message: 'Call not found' });
      return;
    }
    
    call.status = 'declined';
    activeCalls.set(callId, call);
    
    const callerSocketId = userSockets.get(call.fromUserId);
    
    console.log(`[Call] Declined: ${callId}`);
    
    // Уведомляем звонящего об отклонении
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:declined', { callId });
    }
    
    // Удаляем из активных звонков
    setTimeout(() => {
      activeCalls.delete(callId);
    }, 5000);
  });
  
  // Завершение звонка
  socket.on('call:end', (data) => {
    const { callId } = data;
    
    if (!socket.userId) {
      socket.emit('call:error', { message: 'Unauthorized' });
      return;
    }
    
    const call = activeCalls.get(callId);
    if (!call) {
      return;
    }
    
    call.status = 'ended';
    
    const callerSocketId = userSockets.get(call.fromUserId);
    const receiverSocketId = userSockets.get(call.toUserId);
    
    console.log(`[Call] Ended: ${callId}`);
    
    // Уведомляем обоих пользователей
    if (callerSocketId) {
      io.to(callerSocketId).emit('call:ended', { callId });
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('call:ended', { callId });
    }
    
    // Удаляем из активных звонков
    setTimeout(() => {
      activeCalls.delete(callId);
    }, 1000);
  });
  
  // Отключение пользователя
  socket.on('disconnect', () => {
    if (socket.userId) {
      const user = users.get(socket.userId);
      if (user) {
        user.isOnline = false;
        users.set(socket.userId, user);
        userSockets.delete(socket.userId);
        
        console.log(`[Socket] User disconnected: ${user.name} (${socket.userId})`);
        
        // Уведомляем остальных об оффлайне
        socket.broadcast.emit('user:offline', {
          userId: socket.userId,
          name: user.name,
        });
      }
    }
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Voice Call Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🌐 REST API: http://localhost:${PORT}/api`);
});
