const express = require('express');
const app = express();

const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const PORT = 3000;

// uploads 폴더 없으면 생성
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  io.emit('receive-image', imageUrl);
  res.json({ imageUrl });
});

io.on('connection', socket => {

  socket.on('new-user', name => {
    socket.broadcast.emit('user-connected', name);
    console.log('user-connected', name + `${socket.id}`);
  });

  socket.on('send-chat-message', data => {
    io.emit('chat-message', data);
    console.log('chat-message', data + `${socket.id}`);
  });

  socket.on('disconnect', name => {
    socket.broadcast.emit('user-disconnected', name);
    console.log('user-connected', name + `${socket.id}`);
  });

  socket.on('send-image', imageUrl => {
    console.log('imageUrl' + `${socket.id}`);
  });

});

http.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
