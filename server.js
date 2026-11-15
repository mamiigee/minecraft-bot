const express = require('express');
const zlib = require('zlib');
const originalWarn = console.warn;
const http = require('http');
const { Server } = require('socket.io');
const AFKBotManager = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const manager = new AFKBotManager();

app.use(express.json());

// UptimeRobot icin sifresiz, cok hafif adres
app.get('/health', (req, res) => res.send('ok'));

// PWA dosyalari: sifre istemez (icinde gizli bir sey yok)
const ICON_192 = Buffer.from('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', 'base64');
const ICON_512 = Buffer.from('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', 'base64');
app.get('/manifest.json', (req, res) => {
    res.type('application/manifest+json').send(JSON.stringify({
        name: 'BotPanel',
        short_name: 'BotPanel',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#121212',
        theme_color: '#121212',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
    }));
});
app.get('/icon-192.png', (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.type('png').send(ICON_192); });
app.get('/icon-512.png', (req, res) => { res.set('Cache-Control', 'public, max-age=86400'); res.type('png').send(ICON_512); });
app.get('/sw.js', (req, res) => {
    res.type('application/javascript').send("self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', e => e.waitUntil(self.clients.claim()));\nself.addEventListener('fetch', () => {});\n");
});

// Panel sifresi: Render > Environment kismina PANEL_PASSWORD (ve istersen PANEL_USER) ekle
const PANEL_USER = process.env.PANEL_USER || 'admin';
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || '';
if (!PANEL_PASSWORD) originalWarn('UYARI: PANEL_PASSWORD tanimli degil, panel sifresiz aciliyor!');

function isAuthorized(header) {
    if (!PANEL_PASSWORD) return true;
    if (!header || !header.startsWith('Basic ')) return false;
    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const i = decoded.indexOf(':');
    if (i < 0) return false;
    return decoded.slice(0, i) === PANEL_USER && decoded.slice(i + 1) === PANEL_PASSWORD;
}

app.use((req, res, next) => {
    if (isAuthorized(req.headers.authorization)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Bot Paneli"');
    res.status(401).send('Giris gerekli');
});

io.use((socket, next) => {
    if (isAuthorized(socket.request.headers.authorization)) return next();
    next(new Error('unauthorized'));
});

// Log yakalayıcı optimize edildi (Regex ile güvenli temizleme)
const originalLog = console.log;
console.log = function(...args) {
    originalLog.apply(console, args);
    const text = args.join(' ');
    const match = text.match(/\[BOT:(.*?)\]/);
    if (match) {
        const botId = match[1];
        const cleanText = text.replace(/\[BOT:.*?\]/, '').trim();
        io.to(botId).emit('chatMessage', { botId, text: cleanText });
    }
};

const htmlPage = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#121212">
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" href="/icon-192.png">
    <link rel="apple-touch-icon" href="/icon-192.png">
    <title>BotPanel</title>
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
        .control-btn { touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none; }
        @media (max-width: 800px) {
            body { flex-direction: column; height: auto; min-height: 100vh; padding: 10px; gap: 10px; }
            .sidebar { width: auto; padding: 10px; overflow-y: visible; }
            #botList { display: flex; flex-wrap: wrap; gap: 6px; }
            .bot-tab { flex: 1 1 140px; }
            .main-content { flex-direction: column; padding: 10px; overflow-y: visible; }
            .bot-form-panel { padding-right: 0; overflow-y: visible; }
            .chat-panel { min-height: 320px; }
            #chatBox { min-height: 240px; font-size: 12px; }
            button, input { min-height: 44px; font-size: 16px; }
            .dpad { max-width: 100%; }
            #inventoryGrid { max-width: 100% !important; overflow-x: auto; }
        }
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
        let mapInterval = null;
        const BLOCK_COLORS = ['#444444', '#3b82f6', '#22c55e', '#eab308', '#71717a', '#78350f', '#a16207'];
        document.addEventListener('visibilitychange', () => { if (!document.hidden && currentActiveBot) updateMap(currentActiveBot); });

        // Socket dinleyicisi tek bir kez tanımlandı (Mükerrer tetiklenme engellendi)
        socket.on('chatMessage', function(data) {
            const { botId, text } = data;
            if (!chatHistories[botId]) {
                chatHistories[botId] = '';
            }
            chatHistories[botId] += text + "\\n";
            
            if (chatHistories[botId].length > 30000) chatHistories[botId] = chatHistories[botId].slice(-20000);

            if (currentActiveBot === botId) {
                const chatBox = document.getElementById('chatBox');
                if(chatBox) {
                    chatBox.textContent = chatHistories[botId];
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
        });

        function showAddBotForm() {
            currentActiveBot = null;
            if(mapInterval) clearInterval(mapInterval);
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
                listHtml += \`<div class="bot-tab \${activeClass}" onclick="selectBot('\${id}')">\${bots[id].online === true ? '🟢' : (bots[id].online === false ? '🔴' : '⚪')} \${id} (\${bots[id].username})</div>\`;
            }
            document.getElementById('botList').innerHTML = listHtml;
        }

        function selectBot(id) {
            currentActiveBot = id;
            if(mapInterval) clearInterval(mapInterval);
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
                        <h3>Anlık Mesaj Gönder</h3>
                        <input type="text" id="manualMsg" placeholder="Mesaj veya komut yazın...">
                        <button class="chat-btn" onclick="sendChat('\${id}')">Gönder</button>
                    </div>
                    <div class="card">
                        <h3>Bot Hareket Kontrolleri</h3>
                        <div class="dpad">
                            <div></div>
                            <button class="control-btn" onpointerdown="sendControl('\${id}', 'forward', true)" onpointerup="sendControl('\${id}', 'forward', false)" onpointerleave="sendControl('\${id}', 'forward', false)" onpointercancel="sendControl('\${id}', 'forward', false)" oncontextmenu="return false">İleri</button>
                            <div></div>
                            <button class="control-btn" onpointerdown="sendControl('\${id}', 'left', true)" onpointerup="sendControl('\${id}', 'left', false)" onpointerleave="sendControl('\${id}', 'left', false)" onpointercancel="sendControl('\${id}', 'left', false)" oncontextmenu="return false">Sol</button>
                            <button class="control-btn" onclick="sendJump('\${id}')">Zıpla</button>
                            <button class="control-btn" onpointerdown="sendControl('\${id}', 'right', true)" onpointerup="sendControl('\${id}', 'right', false)" onpointerleave="sendControl('\${id}', 'right', false)" onpointercancel="sendControl('\${id}', 'right', false)" oncontextmenu="return false">Sağ</button>
                            <div></div>
                            <button class="control-btn" onpointerdown="sendControl('\${id}', 'back', true)" onpointerup="sendControl('\${id}', 'back', false)" onpointerleave="sendControl('\${id}', 'back', false)" onpointercancel="sendControl('\${id}', 'back', false)" oncontextmenu="return false">Geri</button>
                            <div></div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-top: 8px;">
                            <button class="control-btn" onpointerdown="sendControl('\${id}', 'sneak', true)" onpointerup="sendControl('\${id}', 'sneak', false)" onpointerleave="sendControl('\${id}', 'sneak', false)" onpointercancel="sendControl('\${id}', 'sneak', false)" oncontextmenu="return false">Eğil (Sneak)</button>
                            <button class="control-btn" onclick="clearBotControls('\${id}')" style="background: #d32f2f;">Durdur</button>
                        </div>
                    </div>
                    <div class="card">
                        <h3>Canlı Harita (Radar)</h3>
                        <canvas id="botMap" width="220" height="220" style="background: #111; border: 1px solid #444; border-radius: 4px; display: block; margin: 0 auto;"></canvas>
                        <div id="coordText" style="text-align: center; font-size: 12px; color: #aaa; margin-top: 5px;">X: 0, Y: 0, Z: 0</div>
                    </div>
                    <div class="card">
                        <h3>Bot Envanteri (Görsel Izgara)</h3>
                        <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                            <button class="chat-btn" onclick="loadInventory('\${id}')" style="flex: 1;">Envanteri Yenile</button>
                            <button class="stop" onclick="dropAll('\${id}')" style="flex: 1; margin: 0;">Hepsini Yere At</button>
                        </div>
                        <div id="inventoryGrid" style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; background: #111; padding: 8px; border-radius: 6px; margin-top: 10px; max-width: fit-content;">
                            <span style="grid-column: span 9; color: #777; font-size: 11px; text-align: center;">Envanteri görmek için butona basın.</span>
                        </div>
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
                chatBox.textContent = chatHistories[id];
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            socket.emit('joinBotRoom', id);
            loadInventory(id);
            startMapPolling(id);
        }

        function startMapPolling(id) {
            updateMap(id);
            mapInterval = setInterval(() => updateMap(id), 5000);
        }

        async function updateMap(id) {
            if (document.hidden) return;
            let json;
            try {
                let res = await fetch('/position/' + id);
                json = await res.json();
            } catch (e) { return; }
            const canvas = document.getElementById('botMap');
            const coordText = document.getElementById('coordText');
            if(!canvas || !coordText) return;

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1;
            for(let i = 0; i < canvas.width; i += 20) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
            }

            if(json.status === "success" && json.position) {
                let { x, y, z, yaw, entities, blocks } = json.position;
                coordText.innerText = \`X: \${x.toFixed(1)}, Y: \${y.toFixed(1)}, Z: \${z.toFixed(1)}\`;

                let cx = canvas.width / 2;
                let cy = canvas.height / 2;

                ctx.save();
                ctx.translate(cx, cy);
                if(yaw !== undefined) {
                    ctx.rotate(-yaw);
                }

                if (blocks && blocks.length > 0) {
                    const S = 7;
                    const fx = x - Math.floor(x);
                    const fz = z - Math.floor(z);
                    blocks.forEach(b => {
                        let relX = (b[0] - fx) * S;
                        let relZ = (b[1] - fz) * S;
                        ctx.fillStyle = BLOCK_COLORS[b[2]] || '#444444';
                        ctx.fillRect(relX - 3.5, relZ - 3.5, S, S);
                    });
                }

                if (entities && entities.length > 0) {
                    entities.forEach(e => {
                        let relX = (e[0] - x) * 7;
                        let relZ = (e[1] - z) * 7;

                        if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
                            ctx.save();
                            ctx.translate(relX, relZ);
                            ctx.fillStyle = e[2] === 1 ? '#2196F3' : '#ff9800';
                            ctx.beginPath();
                            ctx.arc(0, 0, 3, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.restore();
                        }
                    });
                }

                ctx.fillStyle = '#4CAF50';
                ctx.beginPath();
                ctx.moveTo(0, -8);
                ctx.lineTo(-6, 8);
                ctx.lineTo(6, 8);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(cx, cy, 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                coordText.innerText = "Konum alınamadı (Bot offline)";
                ctx.fillStyle = '#777';
                ctx.font = '11px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("Bot Aktif Değil", canvas.width / 2, canvas.height / 2);
            }
        }

        function getBlockColor(name) {
            if (name.includes('water')) return '#3b82f6';
            if (name.includes('grass') || name.includes('leaves')) return '#22c55e';
            if (name.includes('sand')) return '#eab308';
            if (name.includes('stone') || name.includes('ore') || name.includes('cobble')) return '#71717a';
            if (name.includes('log') || name.includes('wood') || name.includes('planks')) return '#78350f';
            if (name.includes('dirt')) return '#a16207';
            return '#444444';
        }

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
                        
                        html += \`<div onclick="dropItem('\${id}', \${i})" title="\${item.name} (Adet: \${item.count}) - Atmak için tıkla" style="width: 32px; height: 32px; background: #2a2a2a; border: 1px solid #555; border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; transition: 0.1s;" onmouseover="this.style.borderColor='#f44336'" onmouseout="this.style.borderColor='#555'">
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

        async function dropItem(id, slot) {
            if(!confirm(\`Slot \${slot} numaralı eşyayı yere atmak istediğinize emin misiniz?\`)) return;
            let res = await fetch('/drop', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id, slot })
            });
            let json = await res.json();
            if(json.status === "success") {
                setTimeout(() => loadInventory(id), 300);
            } else {
                alert(json.message);
            }
        }

        async function dropAll(id) {
            if(!confirm(\`Bot (\${id}) üzerindeki TÜM eşyaları yere atmak istediğinize emin misiniz?\`)) return;
            let res = await fetch('/drop-all', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id })
            });
            let json = await res.json();
            alert(json.message);
            setTimeout(() => loadInventory(id), 1000);
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
            if(mapInterval) clearInterval(mapInterval);
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

        async function refreshStatus() {
            if (document.hidden) return;
            try {
                let res = await fetch('/bots');
                let fresh = await res.json();
                for (let id in fresh) { if (bots[id]) bots[id].online = fresh[id].online; }
                updateBotList();
            } catch (e) {}
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }

        async function init() {
            let res = await fetch('/bots');
            let activeBots = await res.json();
            bots = activeBots;
            updateBotList();
            setInterval(refreshStatus, 15000);
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
`;

app.get('/', (req, res) => {
    res.send(htmlPage);
});

io.on('connection', (socket) => {
    socket.on('joinBotRoom', (botId) => {
        socket.join(botId);
    });
});

app.get('/bots', (req, res) => {
    const list = manager.getActiveBots();
    for (const id in list) {
        const inst = manager.bots.get(id);
        list[id].online = !!(inst && inst.bot && inst.bot.entity);
        delete list[id].startupCommands;
    }
    res.json(list);
});

app.get('/inventory/:id', (req, res) => {
    const items = manager.getInventory(req.params.id);
    if (items) {
        res.json({ status: "success", items });
    } else {
        res.json({ status: "error", message: "Bot aktif değil!" });
    }
});

function blockColorIndex(name) {
    if (name.includes('water')) return 1;
    if (name.includes('grass') || name.includes('leaves')) return 2;
    if (name.includes('sand')) return 3;
    if (name.includes('stone') || name.includes('ore') || name.includes('cobble')) return 4;
    if (name.includes('log') || name.includes('wood') || name.includes('planks')) return 5;
    if (name.includes('dirt')) return 6;
    return 0;
}

app.get('/position/:id', (req, res) => {
    const raw = manager.getPosition ? manager.getPosition(req.params.id) : null;
    let body;
    if (raw) {
        const R = 15; // radar yaricapi (blok)
        const bx = Math.floor(raw.x);
        const bz = Math.floor(raw.z);
        const blocks = [];
        for (const b of raw.blocks || []) {
            const dx = b.x - bx;
            const dz = b.z - bz;
            if (Math.abs(dx) <= R && Math.abs(dz) <= R) blocks.push([dx, dz, blockColorIndex(b.name)]);
        }
        const entities = (raw.entities || [])
            .filter(e => Math.abs(e.x - raw.x) <= R + 2 && Math.abs(e.z - raw.z) <= R + 2)
            .map(e => [Math.round(e.x * 10) / 10, Math.round(e.z * 10) / 10, e.type === 'player' ? 1 : 0]);
        body = { status: "success", position: { x: raw.x, y: raw.y, z: raw.z, yaw: raw.yaw, entities, blocks } };
    } else {
        body = { status: "error", message: "Bot aktif değil veya konum alınamadı!" };
    }
    const payload = Buffer.from(JSON.stringify(body));
    if ((req.headers['accept-encoding'] || '').includes('gzip')) {
        res.set({ 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
        res.send(zlib.gzipSync(payload));
    } else {
        res.type('json').send(payload);
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

app.post('/drop', (req, res) => {
    const { id, slot } = req.body;
    const result = manager.dropItem(id, parseInt(slot));
    res.json(result);
});

app.post('/drop-all', (req, res) => {
    const { id } = req.body;
    const result = manager.dropAllItems(id);
    res.json(result);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Panel çalışıyor: http://localhost:${PORT}`);
});
