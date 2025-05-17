const socket = io();
const chat = document.getElementById('chat');
const input = document.getElementById('message-input');
const imageInput = document.getElementById('image-input');

let myName = prompt('닉네임을 입력하세요');
socket.emit('new-user', myName);

socket.on('chat-message', data => {
  appendMessage(`${data.name}: ${data.message}`);
});

socket.on('user-connected', name => {
  appendMessage(`${name} 님이 입장하셨습니다`);
});

socket.on('user-disconnected', name => {
  appendMessage(`${name} 님이 퇴장하셨습니다`);
});


socket.on('receive-image', url => {
  const div = document.createElement('div');
  const img = document.createElement('img');
  img.src = url;
  img.style.maxWidth = '200px';
  img.style.display = 'block';
  img.style.marginTop = '5px';
  div.appendChild(img);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

function sendMessage() {
  const message = input.value.trim();
  if (!message) return;
  socket.emit('send-chat-message', { message: message, name: myName });
  input.value = '';
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);
  formData.append('name', myName);

  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    // 서버가 응답으로 imageUrl을 보내준 경우
    const img = document.createElement('img');
    img.src = data.imageUrl;
    img.style.maxWidth = '200px';
    img.style.display = 'block';
    img.style.marginTop = '5px';
    chat.appendChild(img);

    // 이미지 업로드 후 필요하다면 서버로 소켓 이벤트 보내기
    socket.emit('send-image', data.imageUrl);
  });
});

function appendMessage(message) {
  const div = document.createElement('div');

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = message.split(urlRegex);

  parts.forEach(part => {
    if (urlRegex.test(part)) {
      const a = document.createElement('a');
      a.href = part;
      a.textContent = part;
      a.target = '_blank';
      div.appendChild(a);
    } else {
      div.appendChild(document.createTextNode(part));
    }
  });

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function appendImageMessage(url) {
  const div = document.createElement('div');
  const img = document.createElement('img');
  img.src = url;
  img.style.maxWidth = '200px';
  img.style.display = 'block';
  img.style.marginTop = '5px';
  div.appendChild(img);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendMessage();
});
