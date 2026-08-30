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
    if (text.includes('[CHAT]')) {
        const cleanText = text.replace('[CHAT]', '').trim();
        io.emit('chatMessage', cleanText);
    }
};

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <title>Minecraft 7/24 AFK Bot Paneli</title>
            <style>
                body { font-family: Arial, sans-serif; background: #121212; color: #fff; margin: 0; padding: 20px; display: flex; gap: 20px; }
                .left-panel { flex: 1; }
                .right-panel { flex: 1; background: #1e1e1e; padding: 15px; border-radius: 8px; height: 85vh; display: flex; flex-direction: column; }
                .card { background: #1e1e1e; padding: 15px; margin-bottom: 15px; border-radius: 8px; }
                input, button { padding: 8px; margin: 5px 0; background: #2d2d2d; color: #fff; border: 1px solid #444; width: 100%; box-sizing: border-box; }
                button { background: #4CAF50; cursor: pointer; font-weight: bold; }
                button.stop { background: #f44336; }
                button.chat { background: #2196F3; }
                #chatBox { background: #000; border: 1px solid #333; flex: 1; border-radius: 5px; padding: 10px; overflow-y: scroll; font-family: monospace; color: #00ff00; font-size: 13px; line-height: 1.4; white-space: pre-wrap; }
            </style>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <div class="left-panel">
                <h1>Minecraft 7/24 AFK Bot Paneli</h1>
                <div class="card">
                    <h3>Bot Ekle ve Başlat</h3>
                    <input type="text" id="botId" placeholder="Bot ID" value="ak">
                    <input type="text" id="username" placeholder="Minecraft Nick" value="AkbabaKursat">
                    <input type="text" id="host" placeholder="Sunucu IP" value="play.hanedanmc.com">
                    <input type="text" id="port" placeholder="Port" value="25565">
                    <input type="text" id="version" placeholder="Minecraft Sürümü" value="1.20.1">
                    <input type="text" id="startupCommands" placeholder="Giriş Komutları (Virgülle ayırın, örn: /login şifre, /skyblock)" value="/login SifrenizBuraya, /skyblock">
                    <button onclick="startBot()">Botu Başlat</button>
                </div>
                
                <div class="card">
                    <h3>Anlık Chat Mesajı Gönder</h3>
                    <input type="text" id="chatBotId" placeholder="Bot ID" value="ak">
                    <input type="text" id="chatMsg" placeholder="Mesaj / Komut">
                    <button class="chat" onclick="sendChat()">Mesaj Gönder</button>
                </div>

                <div class="card">
                    <h3>Botu Durdur</h3>
                    <input type="text" id="stopBotId" placeholder="Bot ID" value="ak">
                    <button class="stop" onclick="stopBot()">Botu Durdur</button>
                </div>
            </div>

            <div class="right-panel">
                <h3>Oyun İçi Sohbet (Canlı Konsol)</h3>
                <div id="chatBox"></div>
            </div>

            <script>
                const socket = io();
                const chatBox = document.getElementById('chatBox');

                socket.on('chatMessage', function(msg) {
                    chatBox.innerHTML += msg + "\\n";
                    chatBox.scrollTop = chatBox.scrollHeight;
                });

                async function startBot() {
                    let data = {
                        id: document.getElementById('botId').value,
                        username: document.getElementById('username').value,
                        host: document.getElementById('host').value,
                        port: document.getElementById('port').value,
                        version: document.getElementById('version').value,
                        startupCommands: document.getElementById('startupCommands').value
                    };
                    let res = await fetch('/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
                    let json = await res.json();
                    alert(json.message);
                }

                async function stopBot() {
                    let data = { id: document.getElementById('stopBotId').value };
                    let res = await fetch('/stop', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
                    let json = await res.json();
                    alert(json.message);
                }

                async function sendChat() {
                    let data = {
                        id: document.getElementById('chatBotId').value,
                        message: document.getElementById('chatMsg').value
                    };
                    let res = await fetch('/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
                    let json = await res.json();
                }
            </script>
        </body>
        </html>
    `);
});

app.post('/start', (req, res) => {
    const { id, username, host, port, version, startupCommands } = req.body;
    const result = manager.startBot(id, username, host, port, version, startupCommands, true);
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
        res.json({ status: "success", message: "Mesaj gönderildi" });
    } else {
        res.json({ status: "error", message: "Bot bulunamadı veya mesaj gönderilemedi" });
    }
});

server.listen(8080, () => {
    console.log('Panel çalışıyor: http://localhost:8080');
});