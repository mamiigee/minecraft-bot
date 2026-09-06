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
    const match = text.match(/\[BOT:(.*?)\]/);
    if (match) {
        const botId = match[1];
        const cleanText = text.replace(`[BOT:${botId}]`, '').trim();
        io.to(botId).emit('chatMessage', { botId, text: cleanText });
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
                .main-content { flex: 1; display: flex; gap: 20px; background: #181818; padding: 20px; border-radius: 8px; border: 1px solid #333; overflow-y: auto; }
                .bot-form-panel { flex: 1; overflow-y: auto; padding-right: 10px; }
                .chat-panel { flex: 1; background: #1e1e1e; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; border: 1px solid #333; }
                .card { background: #222; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #444; }
                input, button { padding: 8px; margin: 5px 0; background: #2d2d2d; color: #fff; border: 1px solid #444; width: 100%; box-sizing: border-box; border-radius: 4px; }
                button { background: #4CAF50; cursor: pointer; font-weight: bold; }
                button.stop { background: #f44336; }
                button.chat-btn { background: #2196F3; }
                button.loop-btn { background: #ff9800; }
                button.control-btn { background: #607D8B; transition: 0.1s; user-select: none; }
                button.control-btn:active { background: #00BCD4; }
                .bot-tab { padding: 10px; background: #2a2a2a; border-radius: 6px; cursor: pointer; border: 1px solid #444; text-align: center; font-weight: bold; transition: 0.2s; }
                .bot-tab:hover, .bot-tab.active { background: #4CAF50; border-color: #66BB6A; }
                .add-btn { background: #ff9800; }
                #chatBox { background: #000; border: 1px solid #333; flex: 1; border-radius: 5px; padding: 12px; overflow-y: scroll; font-family: 'Courier New', Courier, monospace; color: #00ff00; font-size: 13px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
                h2, h3 { margin-top: 0; color: #4CAF50; }
                label { font-size: 12px; color: #aaa; display: block; margin-top: 5px; }
                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #777; text-align: center; width: 100%; }
                .dpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; max-width: 200px; margin: 10px auto; }
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
                    <p>Sol taraftaki "+ Yeni Bot Ekle" butonuna tıklayarak istediğiniz kadar bot yapılandırabilirsiniz.</p>
                </div>
            </div>

            <script>
                const socket = io();
                let bots = {};
                let chatHistories = {};
                let currentActiveBot = null;

                function showAddBotForm() {
                    currentActiveBot = null;
                    updateBotList();
                    document.getElementById('mainContainer').innerHTML = \`
                        <div class="bot-form-panel">
                            <h3>Yeni Bot Ekle ve Başlat</h3>
                            <div class="card">
                                <label>Bot ID (Örn: bot1, bot2, farm)</label>
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
                                <label>Loop 1 Mesajı</label>
                                <input type="text" id="newLoopMsg1" placeholder="Boş bırakılabilir">
                                <label>Loop 1 Süresi (Saniye)</label>
                                <input type="text" id="newLoopInterval1" value="60">
                                <label>Loop 2 Mesajı</label>
                                <input type="text" id="newLoopMsg2" placeholder="Boş bırakılabilir">
                                <label>Loop 2 Süresi (Saniye)</label>
                                <input type="text" id="newLoopInterval2" value="60">
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
                        recurringMsg1: document.getElementById('newLoopMsg1').value,
                        recurringInterval1: document.getElementById('newLoopInterval1').value,
                        recurringMsg2: document.getElementById('newLoopMsg2').value,
                        recurringInterval2: document.getElementById('newLoopInterval2').value
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

                    document.getElementById('mainContainer').innerHTML = \`
                        <div class="bot-form-panel">
                            <h3>Bot Yönetimi: \${id}</h3>
                            <div class="card">
                                <p><b>Kullanıcı:</b> \${bots[id].username}</p>
                                <p><b>Sunucu:</b> \${bots[id].host}:\${bots[id].port}</p>
                                <button class="stop" onclick="stopBot('\${id}')">Botu Durdur / Oyundan Çıkar</button>
                            </div>

                            <div class="card">
                                <h3>Bot Hareket Kontrolleri</h3>
                                <div class="dpad">
                                    <div></div>
                                    <button class="control-btn" onmousedown="sendControl('\${id}', 'forward', true)" onmouseup="sendControl('\${id}', 'forward', false)" onmouseleave="sendControl('\${id}', 'forward', false)">İleri</button>
                                    <div></div>
                                    <button class="control-btn" onmousedown="sendControl('\${id}', 'left', true)" onmouseup="sendControl('\${id}', 'left', false)" onmouseleave="sendControl('\${id}', 'left', false)">Sol</button>
                                    <button class="control-btn" onclick="sendJump('\${id}')">Zıpla</button>
                                    <button class="control-btn" onmousedown="sendControl('\${id}', 'right', true)" onmouseup="sendControl('\${id}', 'right', false)" onmouseleave="sendControl('\${id}', 'right', false)">Sağ</button>
                                    <div></div>
                                    <button class="control-btn" onmousedown="sendControl('\${id}', 'back', true)" onmouseup="sendControl('\${id}', 'back', false)" onmouseleave="sendControl('\${id}', 'back', false)">Geri</button>
                                    <div></div>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-top: 8px;">
                                    <button class="control-btn" onmousedown="sendControl('\${id}', 'sneak', true)" onmouseup="sendControl('\${id}', 'sneak', false)" onmouseleave="sendControl('\${id}', 'sneak', false)">Eğil (Sneak)</button>
                                    <button class="control-btn" onclick="clearBotControls('\${id}')" style="background: #d32f2f;">Durdur</button>
                                </div>
                            </div>

                            <div class="card">
                                <h3>Bot Envanteri (Görsel Izgara)</h3>
                                <button class="chat-btn" onclick="loadInventory('\${id}')">Envanteri Yenile</button>
                                <div id="inventoryGrid" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; background: #111; padding: 8px; border-radius: 6px; margin-top: 10px; max-width: fit-content;">
                                    <span style="grid-column: span 9; color: #777; font-size: 11px; text-align: center;">Envanteri görmek için butona basın.</span>
                                </div>
                            </div>
                            <div class="card">
                                <h3>Anlık Mesaj Gönder</h3>
                                <input type="text" id="manualMsg" placeholder="Mesaj veya komut yazın...">
                                <button class="chat-btn" onclick="sendChat('\${id}')">Gönder</button>
                            </div>
                            <div class="card">
                                <h3>Tekrarlayan Mesaj 1 (Loop 1)</h3>
                                <label>Loop 1 Mesajı</label>
                                <input type="text" id="loopMsgInput1" value="\${bots[id].recurringMsg1 || ''}" placeholder="Sürekli tekrarlanacak mesaj 1">
                                <label>Süre (Saniye)</label>
                                <input type="text" id="loopIntervalInput1" value="\${bots[id].recurringInterval1 || 60}" placeholder="60">
                                <button class="loop-btn" onclick="updateLoop1('\${id}')">Döngü 1'i Güncelle</button>
                            </div>
                            <div class="card">
                                <h3>Tekrarlayan Mesaj 2 (Loop 2)</h3>
                                <label>Loop 2 Mesajı</label>
                                <input type="text" id="loopMsgInput2" value="\${bots[id].recurringMsg2 || ''}" placeholder="Sürekli tekrarlanacak mesaj 2">
                                <label>Süre (Saniye)</label>
                                <input type="text" id="loopIntervalInput2" value="\${bots[id].recurringInterval2 || 60}" placeholder="60">
                                <button class="loop-btn" onclick="updateLoop2('\${id}')">Döngü 2'yi Güncelle</button>
                            </div>
                        </div>
                        <div class="chat-panel">
                            <h3>\${id} - Canlı Konsol ve Chat</h3>
                            <div id="chatBox"></div>
                        </div>
                    \`;

                    const chatBox = document.getElementById('chatBox');
                    if (chatHistories[id]) {
                        chatBox.innerHTML = chatHistories[id];
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }

                    socket.emit('joinBotRoom', id);
                    loadInventory(id);
                }

                socket.off('chatMessage');
                socket.on('chatMessage', function(data) {
                    const { botId, text } = data;
                    if (!chatHistories[botId]) {
                        chatHistories[botId] = '';
                    }
                    chatHistories[botId] += text + "\\n";
                    
                    if (currentActiveBot === botId) {
                        const chatBox = document.getElementById('chatBox');
                        if(chatBox) {
                            chatBox.innerHTML = chatHistories[botId];
                            chatBox.scrollTop = chatBox.scrollHeight;
                        }
                    }
                });

                async function sendControl(id, control, status) {
                    await fetch('/control', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id, control, status })
                    });
                }

                async function sendJump(id) {
                    await fetch('/jump', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id })
                    });
                }

                async function clearBotControls(id) {
                    await fetch('/clear-controls', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id })
                    });
                }

                async function loadInventory(id) {
                    let res = await fetch('/inventory/' + id);
                    let json = await res.json();
                    const grid = document.getElementById('inventoryGrid');
                    if(!grid) return;

                    if(json.status === "success") {
                        let html = '';
                        for(let i = 9; i <= 44; i++) {
                            let item = json.items[i];
                            if(item) {
                                let itemUrl = \`https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/\${item.name}.png\`;
                                let blockUrl = \`https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/block/\${item.name}.png\`;
                                
                                html += \`<div title="\${item.name} (Adet: \${item.count})" style="width: 32px; height: 32px; background: #2a2a2a; border: 1px solid #555; border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer;">
                                    <img src="\${itemUrl}" onerror="if(this.src.includes('/item/')) { this.src='\${blockUrl}'; } else { this.style.display='none'; this.nextElementSibling.style.display='block'; }" style="width: 24px; height: 24px; image-rendering: pixelated;" />
                                    <span style="display: none; font-size: 8px; color: #fff; text-align: center; overflow: hidden; width: 28px; word-break: break-all;">\${item.name.substring(0,3)}</span>
                                    <span style="position: absolute; bottom: 0px; right: 2px; color: #ffff55; font-weight: bold; font-size: 10px; text-shadow: 1px 1px #000;">\${item.count > 1 ? item.count : ''}</span>
                                </div>\`;
                            } else {
                                html += \`<div style="width: 32px; height: 32px; background: #1a1a1a; border: 1px solid #333; border-radius: 4px;"></div>\`;
                            }
                        }
                        grid.innerHTML = html;
                    } else {
                        grid.innerHTML = \`<span style="color:red; font-size:11px; grid-column: span 9;">\${json.message}</span>\`;
                    }
                }

                async function updateLoop1(id) {
                    let msg = document.getElementById('loopMsgInput1').value;
                    let interval = document.getElementById('loopIntervalInput1').value;
                    
                    bots[id].recurringMsg1 = msg;
                    bots[id].recurringInterval1 = interval;

                    let res = await fetch('/loop1', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, message: msg, interval: interval})});
                    let json = await res.json();
                    alert(json.message);
                }

                async function updateLoop2(id) {
                    let msg = document.getElementById('loopMsgInput2').value;
                    let interval = document.getElementById('loopIntervalInput2').value;
                    
                    bots[id].recurringMsg2 = msg;
                    bots[id].recurringInterval2 = interval;

                    let res = await fetch('/loop2', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, message: msg, interval: interval})});
                    let json = await res.json();
                    alert(json.message);
                }

                async function stopBot(id) {
                    let res = await fetch('/stop', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id})});
                    let json = await res.json();
                    alert(json.message);
                    delete bots[id];
                    delete chatHistories[id];
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

                async function init() {
                    let res = await fetch('/bots');
                    let activeBots = await res.json();
                    bots = activeBots;
                    updateBotList();
                    let keys = Object.keys(bots);
                    if(keys.length > 0) {
                        selectBot(keys[0]);
                    } else {
                        showAddBotForm();
                    }
                }

                init();
            </script>
        </body>
        </html>
    `);
});

io.on('connection', (socket) => {
    socket.on('joinBotRoom', (botId) => {
        socket.join(botId);
    });
});

app.get('/bots', (req, res) => {
    res.json(manager.getActiveBots());
});

app.get('/inventory/:id', (req, res) => {
    const items = manager.getInventory(req.params.id);
    if (items) {
        res.json({ status: "success", items });
    } else {
        res.json({ status: "error", message: "Bot aktif değil!" });
    }
});

app.post('/start', (req, res) => {
    const { id, username, host, port, version, startupCommands, recurringMsg1, recurringInterval1, recurringMsg2, recurringInterval2 } = req.body;
    const result = manager.startBot(id, username, host, port, version, startupCommands, recurringMsg1, recurringInterval1, recurringMsg2, recurringInterval2, true);
    res.json(result);
});

app.post('/control', (req, res) => {
    const { id, control, status } = req.body;
    const result = manager.setControlState(id, control, status);
    res.json(result);
});

app.post('/jump', (req, res) => {
    const { id } = req.body;
    const result = manager.jump(id);
    res.json(result);
});

app.post('/clear-controls', (req, res) => {
    const { id } = req.body;
    const result = manager.clearControls(id);
    res.json(result);
});

app.post('/loop1', (req, res) => {
    const { id, message, interval } = req.body;
    const success = manager.setLoop1(id, message, parseInt(interval));
    if (success) {
        res.json({ status: "success", message: "Tekrarlayan mesaj 1 güncellendi!" });
    } else {
        res.json({ status: "error", message: "Bot bulunamadı!" });
    }
});

app.post('/loop2', (req, res) => {
    const { id, message, interval } = req.body;
    const success = manager.setLoop2(id, message, parseInt(interval));
    if (success) {
        res.json({ status: "success", message: "Tekrarlayan mesaj 2 güncellendi!" });
    } else {
        res.json({ status: "error", message: "Bot bulunamadı!" });
    }
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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Panel çalışıyor: http://localhost:${PORT}`);
});
