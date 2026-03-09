import * as THREE from 'three';

const container = document.getElementById('game');
let socket = null;
let myNickname = '';
let gameStarted = false;

// Voice chat
let voiceEnabled = false;
let localStream = null;
const peers = {}; // { peerId: SimplePeer instance }
let voiceStateEl = null;
let SimplePeer = null; // Will be loaded dynamically

// Login screen
const loginScreen = document.getElementById('loginScreen');
const nicknameInput = document.getElementById('nicknameInput');
const playButton = document.getElementById('playButton');
const leaderboard = document.getElementById('leaderboard');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
let chatActive = false;

playButton.addEventListener('click', startGame);
nicknameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && nicknameInput.value.trim()) {
    startGame();
  }
});

function startGame() {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert('Введи ник!');
    return;
  }
  
  myNickname = nickname;
  loginScreen.style.display = 'none';
  document.getElementById('ui').style.display = 'block';
  document.getElementById('nickname').textContent = myNickname;
  
  // Initialize voice state element after UI is shown
  voiceStateEl = document.getElementById('voiceState');
  
  // Load SimplePeer from global scope
  if (window.SimplePeer) {
    SimplePeer = window.SimplePeer;
  }
  
  socket = io();
  
  socket.on('connect', () => {
    console.log('Connected to server');
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    if (reason === 'io server disconnect') {
      // Server disconnected, try to reconnect
      socket.connect();
    }
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
    addChatMessage(null, 'Переподключение к серверу...', 'system');
  });
  
  socket.on('reconnect_error', (error) => {
    console.error('Reconnection error:', error);
  });
  
  initGame();
}

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x16213e);
scene.fog = new THREE.Fog(0x16213e, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 40);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
scene.add(dirLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(400, 300);
const groundMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x1a2a3a,
  roughness: 0.8
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid
const gridHelper = new THREE.GridHelper(400, 80, 0x0f3460, 0x0f3460);
scene.add(gridHelper);

// Audio
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;
  const buffer = audioContext.createBuffer(1, 1, 22050);
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start(0);
  audioUnlocked = true;
}

document.addEventListener('click', unlockAudio);
document.addEventListener('keydown', unlockAudio);

function playSound(freq, duration, type = 'sine') {
  if (!audioUnlocked) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.frequency.value = freq;
  osc.type = type;
  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + duration);
}

function shootSound() {
  playSound(200, 0.1, 'square');
}

function hitSound() {
  playSound(100, 0.15, 'sawtooth');
}

function powerupSound() {
  playSound(600, 0.2, 'sine');
  setTimeout(() => playSound(800, 0.2, 'sine'), 100);
}

// Game state
let myId = null;
let players = {};
let bullets = {};
let powerups = [];
const playerMeshes = {};
const bulletMeshes = {};
const powerupMeshes = {};

const keys = {};
let mouseDown = false;
let lastShot = 0;
let mouseX = 0;
let mouseY = 0;
let showLeaderboard = false;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!chatActive) {
      chatActive = true;
      chatInput.focus();
      chatInput.placeholder = 'Введи сообщение...';
    } else {
      const message = chatInput.value.trim();
      if (message && socket) {
        socket.emit('chatMessage', message);
        chatInput.value = '';
      }
      chatActive = false;
      chatInput.blur();
      chatInput.placeholder = 'Нажми ENTER для чата...';
    }
    return;
  }
  
  if (e.key === 'Escape' && chatActive) {
    chatActive = false;
    chatInput.value = '';
    chatInput.blur();
    chatInput.placeholder = 'Нажми ENTER для чата...';
    return;
  }
  
  if (!chatActive) {
    keys[e.key.toLowerCase()] = true;
    
    if (e.key.toLowerCase() === 'p') {
      toggleVoice();
    }
  }
  
  if (e.key === 'Tab') {
    e.preventDefault();
    showLeaderboard = true;
    leaderboard.style.display = 'block';
    updateLeaderboard();
  }
});

window.addEventListener('keyup', (e) => {
  if (!chatActive) {
    keys[e.key.toLowerCase()] = false;
  }
  if (e.key === 'Tab') {
    showLeaderboard = false;
    leaderboard.style.display = 'none';
  }
});
window.addEventListener('mousedown', () => mouseDown = true);
window.addEventListener('mouseup', () => mouseDown = false);
window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Tank creation
function createTank(color) {
  const tank = new THREE.Group();
  
  // Body
  const bodyGeometry = new THREE.BoxGeometry(4, 2, 3);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.position.y = 1;
  tank.add(body);
  
  // Turret group (для поворота башни)
  const turretGroup = new THREE.Group();
  turretGroup.position.y = 2;
  tank.add(turretGroup);
  
  // Turret
  const turretGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1.5, 8);
  const turret = new THREE.Mesh(turretGeometry, bodyMaterial);
  turret.castShadow = true;
  turret.position.y = 0.25;
  turretGroup.add(turret);
  
  // Cannon
  const cannonGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
  const cannonMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
  cannon.castShadow = true;
  cannon.rotation.z = Math.PI / 2;
  cannon.position.set(1.5, 0.25, 0);
  turretGroup.add(cannon);
  
  tank.userData.turret = turretGroup;
  
  return tank;
}

function createBullet() {
  const geometry = new THREE.SphereGeometry(0.3, 8, 8);
  const material = new THREE.MeshStandardMaterial({ 
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 0.5
  });
  const bullet = new THREE.Mesh(geometry, material);
  bullet.castShadow = true;
  return bullet;
}

function createPowerup(type) {
  const geometry = new THREE.OctahedronGeometry(1.5);
  const material = new THREE.MeshStandardMaterial({ 
    color: type === 'speed' ? 0x00ff88 : 0xff4444,
    emissive: type === 'speed' ? 0x00ff88 : 0xff4444,
    emissiveIntensity: 0.3
  });
  const powerup = new THREE.Mesh(geometry, material);
  powerup.castShadow = true;
  return powerup;
}

function updateLeaderboard() {
  const list = document.getElementById('leaderboardList');
  const sorted = Object.values(players).sort((a, b) => b.score - a.score);
  
  list.innerHTML = sorted.map((p, i) => `
    <div class="leaderboard-item ${p.id === myId ? 'me' : ''}">
      <span class="leaderboard-rank">#${i + 1}</span>
      <span class="leaderboard-name">${p.nickname || 'Игрок'}</span>
      <span class="leaderboard-score">${p.score}</span>
    </div>
  `).join('');
}

function initGame() {
  // Socket events
  socket.emit('join', { nickname: myNickname });
  
  socket.on('init', (data) => {
    myId = data.id;
    players = data.players;
    powerups = data.powerups;
    
    for (let id in players) {
      const p = players[id];
      playerMeshes[id] = createTank(p.color);
      scene.add(playerMeshes[id]);
    }
    
    powerups.forEach(p => {
      powerupMeshes[p.id] = createPowerup(p.type);
      scene.add(powerupMeshes[p.id]);
    });
    
    console.log('Game initialized, myId:', myId);
    
    gameStarted = true;
    gameLoop();
  });

  socket.on('serverFull', () => {
    alert('Сервер полон! Максимум 20 игроков.');
    location.reload();
  });

  socket.on('newPlayer', (player) => {
    players[player.id] = player;
    playerMeshes[player.id] = createTank(player.color);
    scene.add(playerMeshes[player.id]);
  });

  socket.on('playerLeft', (id) => {
    delete players[id];
    if (playerMeshes[id]) {
      scene.remove(playerMeshes[id]);
      delete playerMeshes[id];
    }
  });

  socket.on('update', (data) => {
    // Check for new bullets
    for (let id in data.bullets) {
      if (!bullets[id] && !bulletMeshes[id]) {
        shootSound();
      }
    }
    
    // Check for hits
    for (let id in players) {
      if (data.players[id] && players[id]) {
        if (data.players[id].health < players[id].health) {
          hitSound();
        }
      }
    }
    
    // Обновляем других игроков (не себя)
    for (let id in data.players) {
      if (id !== myId) {
        // Полностью обновляем данные других игроков
        players[id] = data.players[id];
      } else {
        // Для себя обновляем только здоровье, очки, скорость, урон (позицию контролируем локально)
        if (players[myId]) {
          players[myId].health = data.players[id].health;
          players[myId].score = data.players[id].score;
          players[myId].speed = data.players[id].speed;
          players[myId].damage = data.players[id].damage;
          players[myId].maxHealth = data.players[id].maxHealth;
        }
      }
    }
    
    bullets = data.bullets;
    powerups = data.powerups;
    
    if (showLeaderboard) {
      updateLeaderboard();
    }
  });

  socket.on('powerupCollected', (id) => {
    powerupSound();
    powerups = powerups.filter(p => p.id !== id);
    if (powerupMeshes[id]) {
      scene.remove(powerupMeshes[id]);
      delete powerupMeshes[id];
    }
  });

  socket.on('chatMessage', (data) => {
    addChatMessage(data.nickname, data.message, 'player');
  });

  socket.on('systemMessage', (message) => {
    addChatMessage(null, message, 'system');
  });

  // Voice chat events
  socket.on('voiceSignal', (data) => {
    console.log('Received voice signal from:', data.from);
    handleVoiceSignal(data);
  });

  socket.on('voiceUserJoined', (userId) => {
    console.log('Voice user joined:', userId, 'My voice enabled:', voiceEnabled, 'myId:', myId);
    if (voiceEnabled && userId !== myId && !peers[userId]) {
      // Always create connection, but only one side initiates
      const shouldInitiate = myId > userId;
      console.log('Creating connection to', userId, 'shouldInitiate:', shouldInitiate);
      
      // Small delay to ensure both sides are ready
      setTimeout(() => {
        if (voiceEnabled && !peers[userId]) {
          createPeerConnection(userId, shouldInitiate);
        }
      }, shouldInitiate ? 100 : 500);
    }
  });

  socket.on('voiceUserLeft', (userId) => {
    console.log('Voice user left:', userId);
    if (peers[userId]) {
      peers[userId].destroy();
      delete peers[userId];
    }
  });
}

async function toggleVoice() {
  // Load SimplePeer if not loaded
  if (!SimplePeer && window.SimplePeer) {
    SimplePeer = window.SimplePeer;
  }
  
  if (!SimplePeer) {
    addChatMessage(null, 'Ошибка загрузки голосового чата', 'system');
    return;
  }
  
  if (!voiceEnabled) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      voiceEnabled = true;
      voiceStateEl.textContent = 'ВКЛ';
      voiceStateEl.classList.add('active');
      
      console.log('Voice enabled, emitting voiceJoin');
      console.log('Local stream tracks:', localStream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      })));
      socket.emit('voiceJoin');
      addChatMessage(null, 'Голосовой чат включен', 'system');
      
      // Don't connect here - wait for voiceUserJoined events
    } catch (err) {
      console.error('Microphone access denied:', err);
      addChatMessage(null, 'Ошибка доступа к микрофону', 'system');
    }
  } else {
    // Disable voice
    console.log('Disabling voice, closing', Object.keys(peers).length, 'peer connections');
    
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      localStream = null;
    }
    
    // Close all peer connections
    for (let id in peers) {
      console.log('Destroying peer:', id);
      if (peers[id]) {
        peers[id].destroy();
      }
      delete peers[id];
    }
    
    voiceEnabled = false;
    voiceStateEl.textContent = 'ВЫКЛ';
    voiceStateEl.classList.remove('active');
    
    console.log('Voice disabled, emitting voiceLeave');
    socket.emit('voiceLeave');
    addChatMessage(null, 'Голосовой чат выключен', 'system');
  }
}

function createPeerConnection(userId, initiator) {
  if (peers[userId] || !SimplePeer) return;
  
  console.log('Creating peer connection:', userId, 'initiator:', initiator);
  
  const peer = new SimplePeer({
    initiator: initiator,
    stream: localStream,
    trickle: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    }
  });

  peer.on('signal', (signal) => {
    console.log('Sending signal to:', userId, 'type:', signal.type);
    socket.emit('voiceSignal', {
      to: userId,
      signal: signal
    });
  });

  peer.on('connect', () => {
    console.log('Peer connected:', userId);
    addChatMessage(null, `WebRTC соединение установлено с ${players[userId]?.nickname || 'игроком'}`, 'system');
  });

  peer.on('stream', (stream) => {
    console.log('Received stream from:', userId);
    console.log('Stream tracks:', stream.getTracks().map(t => ({
      kind: t.kind,
      enabled: t.enabled,
      muted: t.muted,
      readyState: t.readyState
    })));
    
    const audio = new Audio();
    audio.srcObject = stream;
    audio.volume = 1.0;
    audio.autoplay = true;
    
    // Store audio element to prevent garbage collection
    peer._audioElement = audio;
    
    // Try to play immediately
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('Audio playing successfully from:', userId);
        addChatMessage(null, `🔊 Слышу ${players[userId]?.nickname || 'игрока'}`, 'system');
      }).catch(err => {
        console.error('Audio play error:', err);
        // Try to play on user interaction
        document.addEventListener('click', () => {
          audio.play().then(() => {
            console.log('Audio playing after user interaction');
            addChatMessage(null, `🔊 Слышу ${players[userId]?.nickname || 'игрока'}`, 'system');
          }).catch(e => console.error('Still cannot play:', e));
        }, { once: true });
        addChatMessage(null, `⚠️ Кликни в игру для воспроизведения голоса`, 'system');
      });
    }
  });

  peer.on('error', (err) => {
    console.error('Peer error with', userId, ':', err);
    addChatMessage(null, `Ошибка соединения с ${players[userId]?.nickname || 'игроком'}`, 'system');
  });

  peer.on('close', () => {
    console.log('Peer connection closed:', userId);
    if (peers[userId]) {
      delete peers[userId];
    }
  });

  peers[userId] = peer;
}

function handleVoiceSignal(data) {
  const { from, signal } = data;
  
  console.log('Handling signal from:', from, 'type:', signal.type, 'Peer exists:', !!peers[from]);
  
  if (!peers[from] && voiceEnabled) {
    console.log('Creating new peer connection for:', from, '(not initiator)');
    createPeerConnection(from, false);
    
    // Give peer time to initialize before signaling
    setTimeout(() => {
      if (peers[from]) {
        try {
          console.log('Signaling peer:', from, 'with type:', signal.type);
          peers[from].signal(signal);
        } catch (err) {
          console.error('Error signaling peer:', from, err);
        }
      }
    }, 100);
  } else if (peers[from]) {
    try {
      console.log('Signaling existing peer:', from, 'with type:', signal.type);
      peers[from].signal(signal);
    } catch (err) {
      console.error('Error signaling peer:', from, err);
    }
  }
}

function addChatMessage(nickname, message, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${type}`;
  
  if (type === 'system') {
    messageDiv.textContent = message;
  } else {
    const nicknameSpan = document.createElement('span');
    nicknameSpan.className = 'chat-nickname';
    nicknameSpan.textContent = nickname + ':';
    
    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = message;
    
    messageDiv.appendChild(nicknameSpan);
    messageDiv.appendChild(textSpan);
  }
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Удаляем старые сообщения (оставляем последние 50)
  while (chatMessages.children.length > 50) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
}

let lastMoveUpdate = 0;

function gameLoop() {
  if (!gameStarted) return;
  const me = players[myId];
  if (!me) return requestAnimationFrame(gameLoop);

  // Movement
  let dx = 0, dy = 0;
  if (keys['w'] || keys['ц']) dy -= 1;
  if (keys['s'] || keys['ы']) dy += 1;
  if (keys['a'] || keys['ф']) dx -= 1;
  if (keys['d'] || keys['в']) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    const moveX = (dx / len) * me.speed;
    const moveY = (dy / len) * me.speed;
    me.x += moveX;
    me.y += moveY;
    me.x = Math.max(-190, Math.min(190, me.x));
    me.y = Math.max(-140, Math.min(140, me.y));
    
    // Поворот корпуса по направлению движения
    me.bodyAngle = Math.atan2(dy, dx);
  }

  // Calculate aim angle from mouse position
  const vector = new THREE.Vector3();
  vector.set(
    (mouseX / window.innerWidth) * 2 - 1,
    -(mouseY / window.innerHeight) * 2 + 1,
    0.5
  );
  vector.unproject(camera);
  vector.sub(camera.position).normalize();
  const distance = -camera.position.y / vector.y;
  const pos = camera.position.clone().add(vector.multiplyScalar(distance));
  
  me.angle = Math.atan2(pos.z - me.y, pos.x - me.x);

  // Send position update (throttled to ~30 FPS to match server)
  const now = Date.now();
  if (now - lastMoveUpdate > 33) {
    socket.emit('move', { x: me.x, y: me.y, angle: me.angle, bodyAngle: me.bodyAngle });
    lastMoveUpdate = now;
  }

  // Shoot
  if (mouseDown && Date.now() - lastShot > 300) {
    socket.emit('shoot', { x: me.x, y: me.y, angle: me.angle });
    lastShot = Date.now();
  }

  // Update UI
  document.getElementById('health').textContent = Math.round(me.health);
  document.getElementById('score').textContent = me.score;
  document.getElementById('speed').textContent = me.speed.toFixed(2);
  document.getElementById('damage').textContent = me.damage;
  document.getElementById('players').textContent = Object.keys(players).length;

  render();
  requestAnimationFrame(gameLoop);
}

function render() {
  const me = players[myId];
  if (!me) return;

  // Update camera (вид сверху)
  camera.position.x = me.x;
  camera.position.y = 50;
  camera.position.z = me.y;
  camera.lookAt(me.x, 0, me.y);

  // Update players
  for (let id in players) {
    const p = players[id];
    if (playerMeshes[id]) {
      playerMeshes[id].position.set(p.x, 0, p.y);
      // Поворот корпуса по направлению движения
      if (p.bodyAngle !== undefined) {
        playerMeshes[id].rotation.y = -p.bodyAngle;
      }
      // Поворот башни по прицелу
      if (playerMeshes[id].userData.turret) {
        playerMeshes[id].userData.turret.rotation.y = -p.angle + (p.bodyAngle || 0);
      }
    }
  }

  // Update bullets
  for (let id in bullets) {
    const b = bullets[id];
    if (!bulletMeshes[id]) {
      bulletMeshes[id] = createBullet();
      scene.add(bulletMeshes[id]);
    }
    bulletMeshes[id].position.set(b.x, 1, b.y);
  }

  // Remove old bullets
  for (let id in bulletMeshes) {
    if (!bullets[id]) {
      scene.remove(bulletMeshes[id]);
      delete bulletMeshes[id];
    }
  }

  // Update powerups
  powerups.forEach(p => {
    if (!powerupMeshes[p.id]) {
      powerupMeshes[p.id] = createPowerup(p.type);
      scene.add(powerupMeshes[p.id]);
    }
    powerupMeshes[p.id].position.set(p.x, 2, p.y);
    powerupMeshes[p.id].rotation.y += 0.02;
    powerupMeshes[p.id].position.y = 2 + Math.sin(Date.now() * 0.003) * 0.5;
  });

  renderer.render(scene, camera);
}
