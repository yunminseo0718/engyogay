const express = require('express');
const app = express();

const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 4000 

const chatHistory = [];

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());

// IP 정규화 함수
function getNormalizedIp(reqOrSocket) {
  let ip = reqOrSocket.headers?.['x-forwarded-for']
    || reqOrSocket.connection?.remoteAddress
    || reqOrSocket.socket?.remoteAddress
    || reqOrSocket.handshake?.address
    || '';

  if (ip.includes('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  if (ip === '::1' || ip === '127.0.0.1') {
    return 'localhost';
  }

  return ip;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

const users = {};      // uuid => name
const userIps = {};    // uuid => ip

// 이미지 업로드
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file || !req.body.uuid) {
    return res.status(400).json({ error: '파일 또는 사용자 정보 누락' });
  }

  const uuid = req.body.uuid;
  const ip = getNormalizedIp(req);

  const imageUrl = `/uploads/${req.file.filename}`;
  const name = users[uuid] || '알 수 없음';

  console.log(`[이미지 전송] ${name} (${ip}): ${imageUrl}`);
  io.emit('receive-image', { name, url: imageUrl });

  res.json({ imageUrl });
});

// 소켓 통신
io.on('connection', socket => {
  // 기존 채팅 기록 전송
  chatHistory.forEach(chatData => {
    socket.emit('chat-message', chatData);
  });

  socket.on('new-user', ({ name, uuid }) => {
    users[uuid] = name;
    const ip = getNormalizedIp(socket.request);
    userIps[uuid] = ip;

    socket.uuid = uuid; // 소켓에 uuid 저장

    console.log(`[NEW] ${name} (${ip})`);
    socket.broadcast.emit('user-connected', name);
  });

  socket.on('send-chat-message', ({ message, uuid }) => {
    const name = users[uuid] || '알 수 없음';
    const ip = userIps[uuid] || 'unknown';
    const timestamp = Date.now();

    console.log(`[MSG] ${name} (${ip}): ${message}`);

    const chatData = { name, message, timestamp, uuid };
    chatHistory.push(chatData); // 채팅 기록 저장

    socket.broadcast.emit('chat-message', chatData);
  });

  socket.on('disconnect', () => {
    const uuid = socket.uuid;
    const name = users[uuid];
    if (name) {
      console.log(`[DIS] ${name}`);
      socket.broadcast.emit('user-disconnected', name);

      delete users[uuid];
      delete userIps[uuid];
    }
  });
});

http.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
