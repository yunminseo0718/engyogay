const socket = io();
const chat = document.getElementById('chat');
const input = document.getElementById('message-input');
const imageInput = document.getElementById('image-input');

let myName = prompt('닉네임을 입력하세요');

let uuid = localStorage.getItem('uuid');
if (!uuid) {
  uuid = crypto.randomUUID();
  localStorage.setItem('uuid', uuid);
}

socket.emit('new-user', { name: myName, uuid });

socket.on('chat-message', data => {
  if (data.name === myName) return;
  appendMessage({
    name: data.name,
    message: data.message,
    timestamp: Date.now(),
    showTime: true,
  });
});

socket.on('user-connected', name => {
  appendMessage({ message: `${name} 님이 입장하셨습니다`, showTime: false });
});

socket.on('user-disconnected', name => {
  appendMessage({ message: `${name} 님이 퇴장하셨습니다`, showTime: false });
});

socket.on('receive-image', data => {
  appendImageMessage(data.name, data.url);
});

function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  appendMessage({
    name: myName,
    message,
    timestamp: Date.now(),
    showTime: true,
  });

  socket.emit('send-chat-message', { message, uuid });
  input.value = '';
}

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('image', file);
  formData.append('uuid', uuid);

  fetch('/upload', {
    method: 'POST',
    body: formData,
  })
    .then(res => res.json())
    .then(() => {
      imageInput.value = '';
    });
});

let lastSender = null;

function appendMessage({ name = '', message = '', timestamp = null, showTime = true }) {
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.alignItems = 'center';
  div.style.gap = '8px';
  div.classList.add('message');

  const isSystemMessage = !name && showTime === false;

  if (isSystemMessage) {
    div.style.justifyContent = 'center';
    div.style.marginTop = '16px';
    div.style.opacity = '0.6';
    div.style.fontSize = '0.9rem';
  } else {
    div.style.marginTop = lastSender === null || lastSender !== name ? '16px' : '0px';
    lastSender = name;
  }

  const messageSpan = document.createElement('span');
  messageSpan.textContent = name ? `${name}: ${message}` : message;
  div.appendChild(messageSpan);

  if (showTime && !isSystemMessage) {
    const timeSpan = document.createElement('span');
    const time = timestamp ? new Date(timestamp) : new Date();
    if (!isNaN(time.getTime())) {
      timeSpan.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    timeSpan.style.fontSize = '0.75rem';
    timeSpan.style.color = '#444341';
    div.appendChild(timeSpan);
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function appendImageMessage(name, url) {
  const div = document.createElement('div');

  const nameText = document.createElement('div');
  nameText.textContent = `${name} 님이 이미지를 보냈습니다`;
  nameText.style.color = '#444341';

  const img = document.createElement('img');
  img.src = url;
  img.style.maxWidth = '200px';
  img.style.display = 'block';
  img.style.marginTop = '5px';
  img.style.borderRadius = '10px';

  div.appendChild(nameText);
  div.appendChild(img);

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
