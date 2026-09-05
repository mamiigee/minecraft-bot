const mineflayer = require('mineflayer');
const fs = require('fs');

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
                recurringMsg: b.recurringMsg,
                recurringInterval: b.recurringInterval
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
                    this.startBot(id, b.username, b.host, b.port, b.version, b.startupCommands, b.recurringMsg, b.recurringInterval, false);
                }
            }
        } catch (e) {}
    }

    startBot(id, username, host, port, version, startupCommands, recurringMsg, recurringInterval, shouldSave = true) {
        if (this.bots.has(id)) {
            this.stopBot(id);
        }

        const botData = {
            username,
            host,
            port: parseInt(port),
            version,
            startupCommands,
            recurringMsg,
            recurringInterval: parseInt(recurringInterval),
            bot: null,
            loopTimer: null,
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

        try {
            botInstance.bot = mineflayer.createBot({
                host: botInstance.host,
                port: botInstance.port,
                username: botInstance.username,
                version: botInstance.version
            });

            botInstance.bot.on('spawn', () => {
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

                if (botInstance.recurringMsg && botInstance.recurringInterval > 0) {
                    if (botInstance.loopTimer) clearInterval(botInstance.loopTimer);
                    botInstance.loopTimer = setInterval(() => {
                        if (botInstance.bot && botInstance.bot.chat) {
                            botInstance.bot.chat(botInstance.recurringMsg);
                        }
                    }, botInstance.recurringInterval * 1000);
                }
            });

            // Gelen tüm mesajları ve JSON yapılarını detaylı yakala
            botInstance.bot.on('message', (jsonMsg, position) => {
                if (position === 2) return; // Action bar mesajlarını yoksay
                
                let text = jsonMsg.toString();
                if (!text || text.trim() === '') return;

                // Eğer mesajın içinde JSON yapısı (ekstra elementler) varsa inceleyelim
                if (jsonMsg.json && jsonMsg.json.extra) {
                    // Sunucu eklentisinin gönderdiği ham yapı bazen buradadır
                    // console.log("JSON Yapısı:", JSON.stringify(jsonMsg.json));
                }

                console.log(`[BOT:${id}] ${text}`);
            });

            botInstance.bot.on('kicked', (reason) => {
                this.cleanupBot(id);
                this.scheduleReconnect(id);
            });

            botInstance.bot.on('end', (reason) => {
                this.cleanupBot(id);
                this.scheduleReconnect(id);
            });

            botInstance.bot.on('error', (err) => {});

        } catch (e) {
            this.scheduleReconnect(id);
        }
    }

    cleanupBot(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return;
        if (botInstance.loopTimer) {
            clearInterval(botInstance.loopTimer);
            botInstance.loopTimer = null;
        }
    }

    scheduleReconnect(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return;
        if (botInstance.reconnectTimeout) clearTimeout(botInstance.reconnectTimeout);

        botInstance.reconnectTimeout = setTimeout(() => {
            this.connectBot(id);
        }, 15000);
    }

    setLoop(id, message, interval) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return false;

        botInstance.recurringMsg = message;
        botInstance.recurringInterval = parseInt(interval);
        this.saveBots();

        if (botInstance.loopTimer) {
            clearInterval(botInstance.loopTimer);
            botInstance.loopTimer = null;
        }

        if (message && botInstance.recurringInterval > 0) {
            botInstance.loopTimer = setInterval(() => {
                if (botInstance.bot && botInstance.bot.chat) {
                    botInstance.bot.chat(message);
                }
            }, botInstance.recurringInterval * 1000);
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

    stopBot(id) {
        const botInstance = this.bots.get(id);
        if (!botInstance) return { status: "error", message: "Bot bulunamadı!" };

        if (botInstance.reconnectTimeout) clearTimeout(botInstance.reconnectTimeout);
        if (botInstance.loopTimer) clearInterval(botInstance.loopTimer);
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
                recurringMsg: b.recurringMsg,
                recurringInterval: b.recurringInterval
            };
        }
        return list;
    }
}

module.exports = AFKBotManager;
