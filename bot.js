const mineflayer = require('mineflayer');

class AFKBotManager {
    constructor() {
        this.bots = {};
        this.botConfigs = {};
        this.intervals = {};
    }

    startBot(id, username, host, port, version = "1.20.1", startupCommands = "", recurringMsg = "", recurringInterval = 60, autoReconnect = true) {
        if (this.bots[id]) {
            return { status: "error", message: `"${id}" ID'li bot zaten çalışıyor!` };
        }

        this.botConfigs[id] = { username, host, port, version, startupCommands, recurringMsg, recurringInterval, autoReconnect };

        const bot = mineflayer.createBot({
            host: host,
            port: parseInt(port) || 25565,
            username: username,
            version: version
        });

        bot.on('spawn', () => {
            console.log(`[BOT:${id}] [Sistem] ${username} sunucuya başarıyla giriş yaptı!`);

            if (startupCommands && startupCommands.trim() !== '') {
                const commands = startupCommands.split(',').map(c => c.trim());
                let delay = 2500;
                commands.forEach((cmd) => {
                    setTimeout(() => {
                        if (this.bots[id]) {
                            try {
                                this.bots[id].chat(cmd);
                                console.log(`[BOT:${id}] [Komut] ${cmd}`);
                            } catch (e) {
                                console.log(`[BOT:${id}] [Hata] ${e.message}`);
                            }
                        }
                    }, delay);
                    delay += 1500;
                });
            }

            if (recurringMsg && recurringMsg.trim() !== '' && recurringInterval > 0) {
                if (this.intervals[id]) clearInterval(this.intervals[id]);
                this.intervals[id] = setInterval(() => {
                    if (this.bots[id]) {
                        try {
                            this.bots[id].chat(recurringMsg);
                            console.log(`[BOT:${id}] [Tekrarlayan] ${recurringMsg}`);
                        } catch (e) {}
                    }
                }, parseInt(recurringInterval) * 1000);
            }
        });

        bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toAnsi ? jsonMsg.toAnsi() : jsonMsg.toString();
            if (text && text.trim() !== '') {
                console.log(`[BOT:${id}] ${text}`);
            }
        });

        bot.on('chat', (user, message) => {
            if (user !== username) {
                console.log(`[BOT:${id}] <${user}> ${message}`);
            }
        });

        bot.on('error', (err) => {
            console.log(`[BOT:${id}] [Hata]: ${err.message}`);
        });

        bot.on('end', (reason) => {
            console.log(`[BOT:${id}] [Koptu] Ayrıldı: ${reason}`);
            if (this.intervals[id]) {
                clearInterval(this.intervals[id]);
                delete this.intervals[id];
            }
            delete this.bots[id];

            const config = this.botConfigs[id];
            if (config && config.autoReconnect) {
                console.log(`[BOT:${id}] [Sistem] 5 saniye sonra yeniden bağlanılıyor...`);
                setTimeout(() => {
                    if (!this.bots[id]) {
                        this.startBot(id, config.username, config.host, config.port, config.version, config.startupCommands, config.recurringMsg, config.recurringInterval, config.autoReconnect);
                    }
                }, 5000);
            }
        });

        this.bots[id] = bot;
        return { status: "success", message: `${username} (${id}) başlatılıyor...` };
    }

    stopBot(id) {
        if (this.botConfigs[id]) {
            this.botConfigs[id].autoReconnect = false;
        }
        if (this.intervals[id]) {
            clearInterval(this.intervals[id]);
            delete this.intervals[id];
        }
        if (this.bots[id]) {
            this.bots[id].quit();
            delete this.bots[id];
            return { status: "success", message: `Bot (${id}) durduruldu.` };
        }
        return { status: "error", message: "Aktif bot bulunamadı!" };
    }

    sendMessage(id, message) {
        if (this.bots[id]) {
            try {
                this.bots[id].chat(message);
                console.log(`[BOT:${id}] [Manuel] ${message}`);
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }
}

module.exports = AFKBotManager;
