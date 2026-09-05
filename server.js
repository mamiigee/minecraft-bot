const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const AFKBotManager = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const manager = new AFKBotManager();

app.use(express.json());

const originalLog = console.log;
console.log = function(...args) {
    originalLog.apply(console, args);
    const text = args.join(' ');
    // [BOT:botId] formatını yakalayıp socket ile ilgili botun odasına gönderiyoruz
    const match = text.match(/\[BOT:(.*?)\]/);
    if (match) {
        const botId = match[1];
        const cleanText = text.replace(`[BOT:${botId}]`, '').trim();
        io.to(botId).emit('chatMessage', cleanText);
    }
};

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Dinamik Çoklu Minecraft Paneli</title>
            <style>
                body { font-family: Arial, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; display: flex; gap: 20px; height: 95vh; box-sizing: border-box; }
                .sidebar { width: 260px; background: #1e1e1e; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; border: 1px solid #333; overflow-y: auto; }
                .main-content { flex: 1; display: flex; gap: 20px; background: #181818; padding: 20px; border-radius: 8px; border: 1px solid #333; }
                .bot-form-panel { flex: 1; overflow-y: auto; padding-right: 10px; }
                .chat-panel { flex: 1; background: #1e1e1e; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; border: 1px solid #333; }
                .card { background: #222; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #444; }
                input, button { padding: 8px; margin: 5px 0; background: #2d2d2d; color: #fff; border: 1px solid #444; width: 100%; box-sizing: border-box; border-radius: 4px; }
                button { background: #4CAF50; cursor: pointer; font-weight: bold; }
                button.stop { background: #f44336; }
                button.chat-btn { background: #2196F3; }
                .bot-tab { padding: 10px; background: #2a2a2a; border-radius: 6px; cursor: pointer; border: 1px solid #444; text-align: center; font-weight: bold; transition: 0.2s; }
                .bot-tab:hover, .bot-tab.active { background: #4CAF50; border-color: #66BB6A; }
                .add-btn { background: #ff9800; }
                #chatBox { background: #000; border: 1px solid #333; flex: 1; border-radius: 5px; padding: 12px; overflow-y: scroll; font-family: 'Courier New', Courier, monospace; color: #00ff00; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
                h2, h3 { margin-top: 0; color: #4CAF50; }
                label { font-size: 12px; color: #aaa; display: block; margin-top: 5px; }
                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #777; text-align: center; }
            </style>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <div class="sidebar">
                <h3>Botlar</h3>
                <div id="botList"></div>
                <button class="add-btn" onclick="showAddBotForm()">+ Yeni Bot Ekle</button>
            </div>

            <div class="main-content" id="mainContainer">
                <div class="empty-state">
                    <h2>Sunucuya girmek için yeni bot ekleyin</h2>
                    <p>Sol taraftaki "+ Yeni Bot Ekle" butonuna tıklayarak ilk botunuzu yapılandırın.</p>
                </div>
            </div>

            <script>
                const socket = io();
                let bots = {};
                let currentActiveBot = null;
                let currentSocketSub = null;

                function showAddBotForm() {
                    currentActiveBot = null;
                    document.getElementById('mainContainer.active']?.classList.remove('active');
                    document.getElementById('mainContainer').innerHTML = \`
                        <div class="bot-form-panel">
                            <h3>Yeni Bot Ekle ve Başlat</h3>
                            <div class="card">
                                <label>Bot ID (Örn: bot1, farm)</label>
                                <input type="text" id="newId" placeholder="bot1">
                                <label>Minecraft Nick</label>
                                <input type="text" id="newUsername" placeholder="Kullanıcı Adı">
                                <label>Sunucu IP</label>
                                <input type="text" id="newHost" value="play.hanedanmc.com">
                                <label>Port</label>
                                <input type="text" id="newPort" value="25565">
                                <label>Sürüm</label>
                                <input type="text" id="newVersion" value="1.20.1">
                                <label>Giriş Komutları (Virgülle ayırın)</label>
                                <input type="text" id="newStartup" value="/login Sifre123, /skyblock">
                                <label>Tekrarlayan (Loop) Mesaj</label>
                                <input type="text" id="newLoopMsg" placeholder="Boş bırakılabilir">
                                <label>Tekrarlama Süresi (Saniye)</label>
                                <input type="text" id="newLoopInterval" value="60">
                                <button onclick="startNewBot()">Botu Başlat ve Kaydet</button>
                            </div>
                        </div>
                    \`;
                }

                async function startNewBot() {
                    let id = document.getElementById('newId').value.trim();
                    if(!id) { alert("Bot ID boş olamaz!"); return; }
                    
                    let data = {
                        id: id,
                        username: document.getElementById('newUsername').value,
                        host: document.getElementById('newHost').value,
                        port: document.getElementById('newPort').value,
                        version: document.getElementById('newVersion').value,
                        startupCommands: document.getElementById('newStartup').value,
                        recurringMsg: document.getElementById('newLoopMsg').value,
                        recurringInterval: document.getElementById('newLoopInterval').value
                    };

                    let res = await fetch('/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
                    let json = await res.json();
                    alert(json.message);
                    
                    if(json.status === "success") {
                        bots[id] = data;
                        updateBotList();
                        selectBot(id);
                    }
                }

                function updateBotList() {
                    let listHtml = '';
                    for(let id in bots) {
                        let activeClass = (currentActiveBot === id) ? 'active' : '';
                        listHtml += \`<div class="bot-tab \${activeClass}" onclick="selectBot('\${id}')">\${id} (\${bots[id].username})</div>\`;
                    }
                    document.getElementById('botList').innerHTML = listHtml;
                }

                function selectBot(id) {
                    currentActiveBot = id;
                    updateBotList();

                    // Önceki socket dinlemesini kaldırıp yeni botun odasına bağlanıyoruz
                    socket.off('chatMessage');

                    document.getElementById('mainContainer').innerHTML = \`
                        <div class="bot-form-panel">
                            <h3>Bot Yönetimi: \${id}</h3>
                            <div class="card">
                                <p><b>Kullanıcı:</b> \${bots[id].username}</p>
                                <p><b>Sunucu:</b> \${bots[id].host}:\${bots[id].port}</p>
                                <button class="stop" onclick="stopBot('\${id}')">Botu Durdur / Oyundan Çıkar</button>
                            </div>
                            <div class="card">
                                <h3>Anlık Mesaj Gönder</h3>
                                <input type="text" id="manualMsg" placeholder="Mesaj veya komut yazın...">
                                <button class="chat-btn" onclick="sendChat('\${id}')">Gönder</button>
                            </div>
                        </div>
                        <div class="chat-panel">
                            <h3>\${id} - Canlı Konsol</h3>
                            <div id="chatBox"></div>
                        </div>
                    \`;

                    // Socket odasına katıl
                    socket.emit('joinBotRoom', id);
                    socket.on('chatMessage', function(msg) {
                        const chatBox = document.getElementById('chatBox');
                        if(chatBox) {
                            chatBox.innerHTML += msg + "\\n";
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    });
                }

                async function stopBot(id) {
                    let res = await fetch('/stop', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id})});
                    let json = await res.json();
                    alert(json.message);
                    delete bots[id];
                    updateBotList();
                    showAddBotForm();
                }

                async function sendChat(id) {
                    let msg = document.getElementById('manualMsg').value;
                    if(!msg) return;
                    let res = await fetch('/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, message: msg})});
                    let json = await res.json();
                    if(json.status === "success") {
                        document.getElementById('manualMsg').value = '';
                    } else {
                        alert(json.message);
                    }
                }

                // Sayfa ilk açıldığında ekle formunu göster
                showAddBotForm();
            </script>
        </body>
        </html>
    `);
});

// Socket.io istemci oda yönetimi eklemesi
io.on('connection', (socket) => {
    socket.on('joinBotRoom', (botId) => {
        socket.join(botId);
    });
});

app.post('/start', (req, res) => {
    const { id, username, host, port, version, startupCommands, recurringMsg, recurringInterval } = req.body;
    const result = manager.startBot(id, username, host, port, version, startupCommands, recurringMsg, recurringInterval, true);
    res.json(result);
});

app.post('/stop', (req, res) => {
    const { id } = req.body;
    const result = manager.stopBot(id);
    res.json(result);
});

app.post('/chat', (req, res) => {
    const { id, message } = req.body;
    const success = manager.sendMessage(id, message);
    if (success) {
        res.json({ status: "success" });
    } else {
        res.json({ status: "error", message: "Bot aktif değil!" });
    }
});

server.listen(8080, () => {
    console.log('Panel çalışıyor: http://localhost:8080');
});
