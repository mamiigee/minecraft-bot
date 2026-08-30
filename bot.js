const mineflayer = require('mineflayer');

class AFKBotManager {
    constructor() {
        this.bots = {};
        this.botConfigs = {}; // Otomatik yeniden bağlanma için ayarları saklıyoruz
    }

    startBot(id, username, host, port, version = "1.20.1", startupCommands = "", autoReconnect = true) {
        if (this.bots[id]) {
            return { status: "error", message: "Bu ID ile zaten çalışan bir bot var!" };
        }

        // Ayarları hafızada tutalım ki koptuğunda aynısıyla tekrar bağlansın
        this.botConfigs[id] = { username, host, port, version, startupCommands, autoReconnect };

        const bot = mineflayer.createBot({
            host: host,
            port: parseInt(port) || 25565,
            username: username,
            version: version
        });

        bot.on('spawn', () => {
            console.log(`[CHAT] [Sistem] ${username} sunucuya başarıyla giriş yaptı!`);

            // Sunucuya girdikten sonra otomatik komutları sırayla gönder (Gecikmeli)
            if (startupCommands && startupCommands.trim() !== '') {
                const commands = startupCommands.split(',').map(c => c.trim());
                let delay = 2500; // İlk giriş için 2.5 saniye bekleme
                commands.forEach((cmd) => {
                    setTimeout(() => {
                        if (this.bots[id]) {
                            try {
                                this.bots[id].chat(cmd);
                                console.log(`[CHAT] [Otomatik Komut] Gönderildi: ${cmd}`);
                            } catch (e) {
                                console.log(`[CHAT] [Hata] Komut gönderilemedi: ${e.message}`);
                            }
                        }
                    }, delay);
                    delay += 1500; // Sonraki komutlar arasına 1.5 saniye koy
                });
            }
        });

        bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toAnsi ? jsonMsg.toAnsi() : jsonMsg.toString();
            if (text && text.trim() !== '') {
                console.log(`[CHAT] ${text}`);
            }
        });

        bot.on('chat', (username, message) => {
            console.log(`[CHAT] <${username}> ${message}`);
        });

        bot.on('error', (err) => {
            console.log(`[CHAT] [Hata]: ${err.message}`);
        });

        bot.on('end', (reason) => {
            console.log(`[CHAT] [Koptu] Oyundan ayrıldı. Sebep: ${reason}`);
            delete this.bots[id];

            // Otomatik Yeniden Bağlanma (Auto-Reconnect)
            const config = this.botConfigs[id];
            if (config && config.autoReconnect) {
                console.log(`[CHAT] [Sistem] 5 saniye sonra sunucuya tekrar bağlanılıyor (${config.username})...`);
                setTimeout(() => {
                    if (!this.bots[id]) {
                        this.startBot(id, config.username, config.host, config.port, config.version, config.startupCommands, config.autoReconnect);
                    }
                }, 5000);
            }
        });

        this.bots[id] = bot;
        return { status: "success", message: `${username} adlı bot başlatılıyor...` };
    }

    stopBot(id) {
        // Kullanıcı manuel durdurursa otomatik bağlanmayı kapat
        if (this.botConfigs[id]) {
            this.botConfigs[id].autoReconnect = false;
        }
        if (this.bots[id]) {
            this.bots[id].quit();
            delete this.bots[id];
            return { status: "success", message: "Bot durduruldu." };
        }
        return { status: "error", message: "Aktif bot bulunamadı!" };
    }

    sendMessage(id, message) {
        if (this.bots[id]) {
            try {
                if (typeof this.bots[id].chat === 'function') {
                    this.bots[id].chat(message);
                } else if (this.bots[id]._client && typeof this.bots[id]._client.write === 'function') {
                    this.bots[id]._client.write('chat', { message: message });
                } else {
                    throw new Error("Chat fonksiyonu aktif değil.");
                }
                return true;
            } catch (e) {
                console.log(`[CHAT] [Hata] Mesaj gönderilemedi: ${e.message}`);
                return false;
            }
        }
        return false;
    }
}

module.exports = AFKBotManager;