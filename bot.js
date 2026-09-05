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

                if (botInstance.recurringMsg && botInstance.recurringInterval > 0) {
                    if (botInstance.loopTimer) clearInterval(botInstance.loopTimer);
                    botInstance.loopTimer = setInterval(() => {
                        if (botInstance.bot && botInstance.bot.chat) {
                            botInstance.bot.chat(botInstance.recurringMsg);
                        }
                    }, botInstance.recurringInterval * 1000);
                }
            });

            botInstance.bot.on('playerChat', (username, translatedMessage, message, jsonMsg) => {
                const formatted = jsonMsg ? jsonMsg.toString() : `<${username}> ${message}`;
                console.log(`[BOT:${id}] ${formatted}`);
            });

            botInstance.bot.on('chat', (username, message, translate, jsonMsg) => {
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
        if (botInstance.loopTimer) {
            clearInterval(botInstance.loopTimer);
            botInstance.loopTimer = null;
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
