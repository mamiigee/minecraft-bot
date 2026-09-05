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

    escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    parseMinecraftJson(obj) {
        if (!obj) return '';
        if (typeof obj === 'string') return this.escapeHtml(obj);
        if (typeof obj === 'number') return obj.toString();

        let html = '';

        if (obj.translate && obj.with && Array.isArray(obj.with)) {
            for (let item of obj.with) {
                html += this.parseMinecraftJson(item);
            }
        } else {
            if (typeof obj.text === 'string' && obj.text !== '') {
                html += this.escapeHtml(obj.text);
            }
            if (obj.extra && Array.isArray(obj.extra)) {
                for (let item of obj.extra) {
                    html += this.parseMinecraftJson(item);
                }
            }
        }

        if (obj.json) {
            html += this.parseMinecraftJson(obj.json);
        }

        if (obj.color && html) {
            let color = obj.color;
            let cssColor = color;
            const mcColors = {
                'black': '#000000', 'dark_blue': '#0000AA', 'dark_green': '#00AA00',
                'dark_aqua': '#00AAAA', 'dark_red': '#AA0000', 'dark_purple': '#AA00AA',
                'gold': '#FFAA00', 'gray': '#AAAAAA', 'dark_gray': '#555555',
                'blue': '#5555FF', 'green': '#55FF55', 'aqua': '#55FFFF',
                'red': '#FF5555', 'light_purple': '#FF55FF', 'yellow': '#FFFF55', 'white': '#FFFFFF'
            };
            if (mcColors[color]) {
                cssColor = mcColors[color];
            }
            return `<span style="color: ${cssColor};">${html}</span>`;
        }

        return html;
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

            botInstance.bot.on('playerChat', (username, translatedMessage, message, jsonMsg) => {
                const formatted = jsonMsg ? this.parseMinecraftJson(jsonMsg) : this.escapeHtml(`<${username}> ${message}`);
                if (formatted.trim()) console.log(`[BOT:${id}] ${formatted}`);
            });

            botInstance.bot.on('chat', (username, message, translate, jsonMsg) => {
                const formatted = jsonMsg ? this.parseMinecraftJson(jsonMsg) : this.escapeHtml(`<${username}> ${message}`);
                if (formatted.trim()) console.log(`[BOT:${id}] ${formatted}`);
            });

            botInstance.bot.on('message', (jsonMsg, position) => {
                if (position === 2) return;

                let text = this.parseMinecraftJson(jsonMsg);
                if (text && text.trim() !== '') {
                    console.log(`[BOT:${id}] ${text}`);
                }
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
            console.log(`[BOT:${id}] [Sen]: ${this.escapeHtml(message)}`);
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
        this.save_bots = this.saveBots();
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
