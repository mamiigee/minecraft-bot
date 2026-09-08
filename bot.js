const mineflayer = require('mineflayer');
const fs = require('fs');
const Vec3 = require('vec3');

class AFKBotManager {
    constructor() {
        this.bots = new Map();
        this.dataFile = './bots.json';
        this.loadAndRestartSavedBots();
    }

    saveBots() {
        let list = {};
        for (let [id, b] of this.bots) {
            list[id] = {
                username: b.username,
                host: b.host,
                port: b.port,
                version: b.version,
                startupCommands: b.startupCommands,
                recurringMsg1: b.recurringMsg1,
                recurringInterval1: b.recurringInterval1,
                recurringMsg2: b.recurringMsg2,
                recurringInterval2: b.recurringInterval2
            };
        }
        fs.writeFileSync(this.dataFile, JSON.stringify(list, null, 2));
    }

    loadAndRestartSavedBots() {
        try {
            if (fs.existsSync(this.dataFile)) {
                let data = fs.readFileSync(this.dataFile, 'utf8');
                let savedBots = JSON.parse(data);
                for (let id in savedBots) {
                    let b = savedBots[id];
                    this.startBot(id, b.username, b.host, b.port, b.version, b.startupCommands, b.recurringMsg1, b.recurringInterval1, b.recurringMsg2, b.recurringInterval2, false);
                }
            }
        } catch (e) {}
    }

    startBot(id, username, host, port, version, startupCommands, recurringMsg1, recurringInterval1, recurringMsg2, recurringInterval2, shouldSave = true) {
        if (this.bots.has(id)) {
            this.stopBot(id);
        }

        const botData = {
            username,
            host,
            port: parseInt(port),
            version,
            startupCommands,
            recurringMsg1: recurringMsg1 || '',
            recurringInterval1: parseInt(recurringInterval1) || 0,
            recurringMsg2: recurringMsg2 || '',
            recurringInterval2: parseInt(recurringInterval2) || 0,
            bot: null,
            loopTimer1: null,
            loopTimer2: null,
            reconnectTimeout: null
        };

        this.bots.set(id, botData);
        if (shouldSave) {
            this.saveBots();
        }

        this.connectBot(id);
        return { status: "success", message: `Bot (${id}) başlatıldı ve kaydedildi!` };
    }

    connectBot(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return;

        if (botInstance.bot) {
            try {
                botInstance.bot.quit();
            } catch (e) {}
            botInstance.bot = null;
        }

        try {
            botInstance.bot = mineflayer.createBot({
                host: botInstance.host,
                port: botInstance.port,
                username: botInstance.username,
                version: botInstance.version
            });

            botInstance.bot.on('spawn', () => {
                console.log(`[BOT:${id}] Oyuna başarıyla bağlandı.`);
                if (botInstance.startupCommands) {
                    const cmds = botInstance.startupCommands.split(',').map(c => c.trim());
                    let delay = 1000;
                    cmds.forEach(cmd => {
                        if (cmd) {
                            setTimeout(() => {
                                if (botInstance.bot && botInstance.bot.chat) {
                                    botInstance.bot.chat(cmd);
                                }
                            }, delay);
                            delay += 1500;
                        }
                    });
                }

                if (botInstance.recurringMsg1 && botInstance.recurringInterval1 > 0) {
                    if (botInstance.loopTimer1) clearInterval(botInstance.loopTimer1);
                    botInstance.loopTimer1 = setInterval(() => {
                        if (botInstance.bot && botInstance.bot.chat) {
                            botInstance.bot.chat(botInstance.recurringMsg1);
                        }
                    }, botInstance.recurringInterval1 * 1000);
                }

                if (botInstance.recurringMsg2 && botInstance.recurringInterval2 > 0) {
                    if (botInstance.loopTimer2) clearInterval(botInstance.loopTimer2);
                    botInstance.loopTimer2 = setInterval(() => {
                        if (botInstance.bot && botInstance.bot.chat) {
                            botInstance.bot.chat(botInstance.recurringMsg2);
                        }
                    }, botInstance.recurringInterval2 * 1000);
                }
            });

            botInstance.bot.on('chat', (username, message) => {
                if (username === botInstance.bot.username) return;

                if (message.startsWith('!')) {
                    const args = message.slice(1).trim().split(/ +/);
                    const command = args.shift().toLowerCase();

                    if (command === 'jump') {
                        botInstance.bot.setControlState('jump', true);
                        setTimeout(() => {
                            if (botInstance.bot) botInstance.bot.setControlState('jump', false);
                        }, 300);
                        botInstance.bot.chat('Zıpladım!');
                    } else if (command === 'say' && args.length > 0) {
                        botInstance.bot.chat(args.join(' '));
                    } else if (command === 'konum' || command === 'coords') {
                        if (botInstance.bot.entity) {
                            const pos = botInstance.bot.entity.position;
                            botInstance.bot.chat(`Konum: X: ${Math.floor(pos.x)}, Y: ${Math.floor(pos.y)}, Z: ${Math.floor(pos.z)}`);
                        }
                    } else if (command === 'spin') {
                        const yaw = botInstance.bot.entity.yaw + Math.PI;
                        botInstance.bot.look(yaw, 0);
                        botInstance.bot.chat('Etrafımda döndüm.');
                    } else if (command === 'dur' || command === 'stopmove') {
                        botInstance.bot.clearControlStates();
                        botInstance.bot.chat('Hareketler durduruldu.');
                    }
                }
            });

            botInstance.bot.on('playerChat', (username, translatedMessage, message, jsonMsg) => {
                const formatted = jsonMsg ? jsonMsg.toString() : `<${username}> ${message}`;
                console.log(`[BOT:${id}] ${formatted}`);
            });

            botInstance.bot.on('message', (jsonMsg, position) => {
                if (position === 2) return;

                let outputText = '';
                try {
                    if (jsonMsg.translate === 'chat.type.text' && jsonMsg.with && jsonMsg.with.length >= 2) {
                        const sender = jsonMsg.with[0] ? jsonMsg.with[0].toString() : '';
                        const msg = jsonMsg.with[1] ? jsonMsg.with[1].toString() : '';
                        outputText = sender ? `<${sender}> ${msg}` : msg;
                    } else {
                        outputText = jsonMsg.toString();
                    }
                } catch (e) {
                    outputText = jsonMsg.toString();
                }

                if (outputText && outputText.trim() !== '') {
                    console.log(`[BOT:${id}] ${outputText}`);
                }
            });

            botInstance.bot.on('kicked', (reason) => {
                console.log(`[BOT:${id}] Oyundan atıldı! Neden:`, JSON.stringify(reason));
                this.cleanupBot(id);
                this.scheduleReconnect(id);
            });

            botInstance.bot.on('end', (reason) => {
                console.log(`[BOT:${id}] Bağlantı koptu. Neden: ${reason}`);
                this.cleanupBot(id);
                this.scheduleReconnect(id);
            });

            botInstance.bot.on('error', (err) => {
                console.log(`[BOT:${id}] Hata: ${err.message}`);
            });

        } catch (e) {
            this.scheduleReconnect(id);
        }
    }

    cleanupBot(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return;
        if (botInstance.loopTimer1) {
            clearInterval(botInstance.loopTimer1);
            botInstance.loopTimer1 = null;
        }
        if (botInstance.loopTimer2) {
            clearInterval(botInstance.loopTimer2);
            botInstance.loopTimer2 = null;
        }
        if (botInstance.bot) {
            try {
                botInstance.bot.quit();
            } catch (e) {}
            botInstance.bot = null;
        }
    }

    scheduleReconnect(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return;
        if (botInstance.reconnectTimeout) clearTimeout(botInstance.reconnectTimeout);

        console.log(`[BOT:${id}] 15 saniye sonra tekrar bağlanılıyor...`);
        botInstance.reconnectTimeout = setTimeout(() => {
            this.connectBot(id);
        }, 15000);
    }

    setLoop1(id, message, interval) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return false;

        botInstance.recurringMsg1 = message;
        botInstance.recurringInterval1 = parseInt(interval);
        this.saveBots();

        if (botInstance.loopTimer1) {
            clearInterval(botInstance.loopTimer1);
            botInstance.loopTimer1 = null;
        }

        if (message && botInstance.recurringInterval1 > 0) {
            botInstance.loopTimer1 = setInterval(() => {
                if (botInstance.bot && botInstance.bot.chat) {
                    botInstance.bot.chat(message);
                }
            }, botInstance.recurringInterval1 * 1000);
        }
        return true;
    }

    setLoop2(id, message, interval) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return false;

        botInstance.recurringMsg2 = message;
        botInstance.recurringInterval2 = parseInt(interval);
        this.saveBots();

        if (botInstance.loopTimer2) {
            clearInterval(botInstance.loopTimer2);
            botInstance.loopTimer2 = null;
        }

        if (message && botInstance.recurringInterval2 > 0) {
            botInstance.loopTimer2 = setInterval(() => {
                if (botInstance.bot && botInstance.bot.chat) {
                    botInstance.bot.chat(message);
                }
            }, botInstance.recurringInterval2 * 1000);
        }
        return true;
    }

    sendMessage(id, message) {
        const botInstance = this.bots.get(id);
        if (botInstance && botInstance.bot && botInstance.bot.chat) {
            botInstance.bot.chat(message);
            console.log(`[BOT:${id}] [Sen]: ${message}`);
            return true;
        }
        return false;
    }

    setControlState(id, control, status) {
        const botInstance = this.bots.get(id);
        if (botInstance && botInstance.bot && botInstance.bot.setControlState) {
            const validControls = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
            if (validControls.includes(control)) {
                botInstance.bot.setControlState(control, status);
                return { status: "success", message: `Bot (${id}) için ${control} durumu ${status} yapıldı.` };
            }
        }
        return { status: "error", message: "Bot aktif değil veya geçersiz kontrol!" };
    }

    jump(id) {
        const botInstance = this.bots.get(id);
        if (botInstance && botInstance.bot) {
            botInstance.bot.setControlState('jump', true);
            setTimeout(() => {
                if (botInstance.bot) {
                    botInstance.bot.setControlState('jump', false);
                }
            }, 300);
            return { status: "success", message: `Bot (${id}) zıpladı!` };
        }
        return { status: "error", message: "Bot aktif değil!" };
    }

    clearControls(id) {
        const botInstance = this.bots.get(id);
        if (botInstance && botInstance.bot && botInstance.bot.clearControlStates) {
            botInstance.bot.clearControlStates();
            return { status: "success", message: `Bot (${id}) hareketleri durduruldu.` };
        }
        return { status: "error", message: "Bot aktif değil!" };
    }

    getPosition(id) {
        const botInstance = this.bots.get(id);
        if (botInstance && botInstance.bot && botInstance.bot.entity) {
            const botPos = botInstance.bot.entity.position;
            let entities = [];
            let blocks = [];
            
            if (botInstance.bot.entities) {
                for (let entId in botInstance.bot.entities) {
                    let e = botInstance.bot.entities[entId];
                    if (e !== botInstance.bot.entity && e.position) {
                        if (e.type === 'player' || e.type === 'mob') {
                            entities.push({
                                x: e.position.x,
                                z: e.position.z,
                                type: e.type,
                                name: e.username || e.name || 'Canlı'
                            });
                        }
                    }
                }
            }

            const radius = 27;
            const bx = Math.floor(botPos.x);
            const bz = Math.floor(botPos.z);
            const by = Math.floor(botPos.y);

            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    let x = bx + dx;
                    let z = bz + dz;
                    let foundBlock = null;
                    
                    for (let y = by + 6; y >= by - 10; y--) {
                        try {
                            let block = botInstance.bot.blockAt(new Vec3(x, y, z));
                            if (block && block.name !== 'air' && block.name !== 'cave_air' && block.name !== 'void_air') {
                                foundBlock = block;
                                break;
                            }
                        } catch (err) {}
                    }

                    if (foundBlock) {
                        blocks.push({
                            x: x,
                            z: z,
                            name: foundBlock.name
                        });
                    }
                }
            }

            return {
                x: botPos.x,
                y: botPos.y,
                z: botPos.z,
                yaw: botInstance.bot.entity.yaw,
                entities: entities,
                blocks: blocks
            };
        }
        return null;
    }

    getInventory(id) {
        const botInstance = this.bots.get(id);
        if (botInstance && botInstance.bot && botInstance.bot.inventory) {
            let slots = {};
            for (let i = 9; i <= 44; i++) {
                const item = botInstance.bot.inventory.slots[i];
                if (item) {
                    slots[i] = {
                        name: item.name,
                        count: item.count
                    };
                }
            }
            return slots;
        }
        return null;
    }

    dropItem(id, slot) {
        const botInstance = this.bots.get(id);
        if (botInstance && botInstance.bot && botInstance.bot.inventory) {
            const item = botInstance.bot.inventory.slots[slot];
            if (!item) {
                return { status: "error", message: "Bu slotta eşya yok!" };
            }
            botInstance.bot.tossStack(item, (err) => {
                if (err) {
                    console.log(`[BOT:${id}] Eşya atılamadı: ${err.message}`);
                } else {
                    console.log(`[BOT:${id}] Eşya atıldı: ${item.name} (${item.count} adet)`);
                }
            });
            return { status: "success", message: "Eşya atma komutu gönderildi." };
        }
        return { status: "error", message: "Bot aktif değil!" };
    }

    dropAllItems(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance || !botInstance.bot || !botInstance.bot.inventory) {
            return { status: "error", message: "Bot aktif değil!" };
        }

        const slots = botInstance.bot.inventory.slots;
        
        const tossNext = (index) => {
            if (index > 44) {
                console.log(`[BOT:${id}] Tüm envanter atma işlemi tamamlandı.`);
                return;
            }
            const item = slots[index];
            if (item) {
                botInstance.bot.tossStack(item, (err) => {
                    setTimeout(() => tossNext(index + 1), 150);
                });
            } else {
                tossNext(index + 1);
            }
        };

        tossNext(9);
        return { status: "success", message: "Tüm envanteri atma işlemi başlatıldı." };
    }

    // YENİ EKLENEN: FM'den eşya çekip, çalışma masasında blok yapma ve döngü yönetimi
    async startFmCraftLoop(id, targetItemName, blockName, totalCount) {
        const botInstance = this.bots.get(id);
        if (!botInstance || !botInstance.bot) {
            return { status: "error", message: "Bot aktif değil!" };
        }
        const bot = botInstance.bot;

        // Belirtilen miktar kadar döngüyü arka planda çalıştır
        (async () => {
            for (let i = 0; i < totalCount; i++) {
                if (!botInstance.bot) break;
                console.log(`[BOT:${id}] [Döngü ${i + 1}/${totalCount}] FM işlemi başlatılıyor...`);

                try {
                    // 1. ADIM: /fm komutunu gönder ve menünün açılmasını bekle
                    bot.chat('/fm');
                    const window = await new Promise((resolve) => {
                        bot.once('windowOpen', resolve);
                        setTimeout(() => resolve(null), 4000);
                    });

                    if (!window) {
                        console.log(`[BOT:${id}] FM menüsü açılamadı, döngü tekrarlanıyor.`);
                        continue;
                    }

                    let foundSlot = -1;
                    let nextButtonSlot = -1;

                    // 1. Sayfa taraması
                    for (let s = 0; s < window.inventoryStart; s++) {
                        let item = window.slots[s];
                        if (item) {
                            const name = (item.name || '').toLowerCase();
                            const displayName = (item.displayName || '').toLowerCase();
                            if (name.includes(targetItemName.toLowerCase()) || displayName.includes(targetItemName.toLowerCase())) {
                                foundSlot = s;
                            }
                            if (name.includes('arrow') || name.includes('paper') || name.includes('map') || displayName.includes('sonraki') || displayName.includes('ileri')) {
                                nextButtonSlot = s;
                            }
                        }
                    }

                    // Eğer 1. sayfada bulunamadıysa ve sonraki sayfa butonu varsa 2. sayfaya geç
                    if (foundSlot === -1 && nextButtonSlot !== -1) {
                        console.log(`[BOT:${id}] Eşya 1. sayfada bulunamadı, 2. sayfaya geçiliyor...`);
                        await bot.clickWindow(nextButtonSlot, 0, 0);
                        await new Promise(r => setTimeout(r, 1000));

                        for (let s = 0; s < window.inventoryStart; s++) {
                            let item = window.slots[s];
                            if (item) {
                                const name = (item.name || '').toLowerCase();
                                const displayName = (item.displayName || '').toLowerCase();
                                if (name.includes(targetItemName.toLowerCase()) || displayName.includes(targetItemName.toLowerCase())) {
                                    foundSlot = s;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundSlot !== -1) {
                        await bot.clickWindow(foundSlot, 0, 0);
                        console.log(`[BOT:${id}] ${targetItemName} tıklandı ve alındı.`);
                        try { bot.closeWindow(window); } catch (e) {}
                    } else {
                        try { bot.closeWindow(window); } catch (e) {}
                        console.log(`[BOT:${id}] Eşya hiçbir sayfada bulunamadı!`);
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }

                    await new Promise(r => setTimeout(r, 1000));

                    // 2. ADIM: Yakındaki crafting table'ı tarayıp bulma
                    const craftingTableBlock = bot.findBlock({
                        matching: block => block.name === 'crafting_table',
                        maxDistance: 6
                    });

                    if (!craftingTableBlock) {
                        console.log(`[BOT:${id}] Yakınlarda çalışma masası bulunamadı!`);
                        continue;
                    }

                    // 3. ADIM: Çalışma masasına sağ tıklayıp açma ve craft etme
                    const craftingTable = await bot.openCraftingTable(craftingTableBlock);
                    const materialName = targetItemName.toLowerCase();
                    const itemType = bot.registry.itemsByName[materialName] || Object.values(bot.registry.itemsByName).find(i => i.name.includes(materialName));
                    
                    if (itemType) {
                        const recipes = bot.recipesFor(itemType.id, null, 1, true, craftingTable);
                        if (recipes.length > 0) {
                            try {
                                await bot.craft(craftingTable, recipes[0], 1);
                                console.log(`[BOT:${id}] Eşya blok haline getirildi.`);
                            } catch (craftErr) {
                                console.log(`[BOT:${id}] Craft hatası: ${craftErr.message}`);
                            }
                        }
                    }
                    
                    try { craftingTable.close(); } catch(e) {}
                    await new Promise(r => setTimeout(r, 1000));

                } catch (loopErr) {
                    console.log(`[BOT:${id}] Döngü sırasında hata: ${loopErr.message}`);
                }

                // Döngüler arası bekleme
                await new Promise(r => setTimeout(r, 2000));
            }
            console.log(`[BOT:${id}] Belirlenen miktar (${totalCount}) kadar FM ve craft döngüsü tamamlandı.`);
        })();

        return { status: "success", message: `Bot (${id}) için ${totalCount} adetlik döngü başlatıldı.` };
    }

    stopBot(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return { status: "error", message: "Bot bulunamadı!" };

        if (botInstance.reconnectTimeout) clearTimeout(botInstance.reconnectTimeout);
        if (botInstance.loopTimer1) clearInterval(botInstance.loopTimer1);
        if (botInstance.loopTimer2) clearInterval(botInstance.loopTimer2);
        if (botInstance.bot) {
            try {
                botInstance.bot.quit();
            } catch(e) {}
        }

        this.bots.delete(id);
        this.saveBots();
        return { status: "success", message: `Bot (${id}) durduruldu!` };
    }

    getActiveBots() {
        let list = {};
        for (let [id, b] of this.bots) {
            list[id] = {
                username: b.username,
                host: b.host,
                port: b.port,
                version: b.version,
                startupCommands: b.startupCommands,
                recurringMsg1: b.recurringMsg1,
                recurringInterval1: b.recurringInterval1,
                recurringMsg2: b.recurringMsg2,
                recurringInterval2: b.recurringInterval2
            };
        }
        return list;
    }
}

module.exports = AFKBotManager;
