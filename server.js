const express = require('express');
const app = express();
const session = require('express-session');
const multer = require('multer');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

const PORT = process.env.PORT || 4000 

const chatHistory = [];

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));



app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 30 }
}));

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 회원가입 처리
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // 기존 사용자 불러오기
  const users = JSON.parse(fs.readFileSync('./users.json', 'utf-8'));

  // 중복 아이디 체크
  if (users.find(u => u.username === username)) {
    return res.send('이미 존재하는 아이디야');
  }

  // 비밀번호 해시
  const passwordHash = await bcrypt.hash(password, 10);

  // 새 사용자 추가
  const newUser = {
    id: Date.now(), // 간단하게 시간 기반 ID
    username,
    passwordHash
  };

  users.push(newUser);
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));

  // 로그인 페이지로 이동
  res.redirect('/login');
});


// 사용자 정보 파일에서 불러오기
const getUsers = () => {
  const data = fs.readFileSync('./users.json', 'utf-8');
  return JSON.parse(data);
};

// 로그인 페이지
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// 로그인 처리
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users.find(u => u.username === username);

  if (!user) return res.send('존재하지 않는 사용자야');

  const match = await bcrypt.compare(password, user.passwordHash);
  if (match) {
    req.session.user = { id: user.id, username: user.username };
    res.send(`환영해, ${user.username}`);
  } else {
    res.send('비밀번호가 틀렸어');
  }
});

// 로그아웃
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.send('로그아웃했어');
});

// index.html 제공
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 로그인한 사용자 정보 반환 (API)
app.get('/api/user', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username });
  } else {
    res.json({ loggedIn: false });
  }
});

//--------------------------------------------------------수정필요함

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
