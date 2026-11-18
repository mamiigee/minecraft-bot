// Tarla gorevi (pancar): sandiktan esya al -> tarlayi hazirla, ek, hasat et -> esyalari sandiga koy -> eve don
const Vec3 = require('vec3');
let pf = null;
try { pf = require('mineflayer-pathfinder'); } catch (e) {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UP = new Vec3(0, 1, 0);
// need: { hoe, seeds, buckets, glow } -> sandiktan alinacak esyalar
const wantedList = (need) => [
    { match: (n) => n.endsWith('_hoe'), count: need.hoe },
    { match: (n) => n === 'beetroot_seeds', count: need.seeds },
    { match: (n) => n === 'water_bucket', count: need.buckets },
    { match: (n) => n === 'glowstone', count: need.glow }
];

function setup(bot) {
    if (!pf) return false;
    bot.loadPlugin(pf.pathfinder);
    bot.once('spawn', () => {
        const mv = new pf.Movements(bot);
        mv.canDig = false;
        mv.allowParkour = false;
        bot.pathfinder.setMovements(mv);
    });
    return true;
}

async function goNear(bot, pos, range) {
    await bot.pathfinder.goto(new pf.goals.GoalNear(pos.x, pos.y, pos.z, range));
}

const findItem = (bot, fn) => bot.inventory.items().find((i) => fn(i.name));
async function equipItem(bot, fn) {
    const it = findItem(bot, fn);
    if (!it) return false;
    await bot.equip(it, 'hand');
    return true;
}

async function useChest(bot, pos, action) {
    await goNear(bot, pos, 3);
    const block = bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block || !/chest|barrel/.test(block.name)) throw new Error('Sandik bulunamadi (' + pos.x + ' ' + pos.y + ' ' + pos.z + ')');
    const c = await bot.openContainer(block);
    try { await action(c); } finally { c.close(); }
}

async function fetchItems(bot, chest, log, need) {
    await useChest(bot, chest, async (c) => {
        for (const w of wantedList(need)) {
            let left = w.count;
            for (const it of c.containerItems()) {
                if (left <= 0) break;
                if (!w.match(it.name)) continue;
                const take = Math.min(it.count, left);
                await c.withdraw(it.type, null, take);
                left -= take;
                log(it.name + ' x' + take + ' alindi');
            }
            if (left > 0) log('UYARI: sandikta ' + left + ' adet eksik (' + (w.match('water_bucket') ? 'su kovasi' : w.match('glowstone') ? 'glowstone' : w.match('beetroot_seeds') ? 'tohum' : 'capa') + ')');
        }
    });
}

async function depositAll(bot, chest, log) {
    await useChest(bot, chest, async (c) => {
        for (const it of bot.inventory.items().slice()) {
            try { await c.deposit(it.type, null, it.count); } catch (e) { log('Sandiga konamadi: ' + it.name); }
        }
    });
}

// Tarlayi bolgelere (step x step) ayirir. Her bolgenin ortasinda 1 su + ustunde 1 glowstone olur.
function plan(a, b, step) {
    const S = Math.min(9, Math.max(3, Number(step) || 4));
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    const z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
    const spans = (min, max) => {
        const out = [];
        for (let s = min; s <= max; s += S) out.push(Math.floor((s + Math.min(s + S - 1, max)) / 2));
        return out;
    };
    const points = new Set();
    for (const px of spans(x0, x1)) for (const pz of spans(z0, z1)) points.add(px + ',' + pz);
    const tiles = [];
    for (let z = z0, row = 0; z <= z1; z++, row++) {
        const xs = [];
        for (let x = x0; x <= x1; x++) xs.push(x);
        if (row % 2) xs.reverse();
        for (const x of xs) tiles.push({ x, z });
    }
    return { y: Number(a.y), step: S, points, tiles, warned: new Set() };
}

async function doTile(bot, p, t, log) {
    const key = t.x + ',' + t.z;
    const ground = bot.blockAt(new Vec3(t.x, p.y, t.z));
    const above = bot.blockAt(new Vec3(t.x, p.y + 1, t.z));
    if (!ground) return;
    const warn = (m) => { if (!p.warned.has(m)) { p.warned.add(m); log(m); } };
    if (bot.entity.position.distanceTo(new Vec3(t.x + 0.5, p.y + 1, t.z + 0.5)) > 3.5) {
        await goNear(bot, new Vec3(t.x, p.y + 1, t.z), 2);
    }

    if (p.points.has(key)) {
        const hasWater = ground.name === 'water';
        const lit = above && above.name === 'glowstone';
        if (hasWater && lit) return;
        // 1) isik: toprak yerindeyken ustune glowstone koy
        if (!lit && !hasWater) {
            if (!findItem(bot, (n) => n === 'glowstone')) warn('Glowstone bitti, isik atlaniyor');
            else {
                if (above && above.name !== 'air') await bot.dig(above);
                await equipItem(bot, (n) => n === 'glowstone');
                await bot.placeBlock(ground, UP);
            }
        }
        // 2) su: altindaki toprak blogunu kaz, yerine su koy
        if (!hasWater) {
            if (!findItem(bot, (n) => n === 'water_bucket')) { warn('Su kovasi bitti, su noktalari atlaniyor'); return; }
            if (ground.name !== 'air') await bot.dig(ground);
            const below = bot.blockAt(new Vec3(t.x, p.y - 1, t.z));
            await equipItem(bot, (n) => n === 'water_bucket');
            await bot.placeBlock(below, UP);
        }
        return;
    }

    if (ground.name === 'dirt' || ground.name === 'grass_block') {
        if (!(await equipItem(bot, (n) => n.endsWith('_hoe')))) { warn('Capa yok ya da kirildi, topraklar surulemiyor'); return; }
        await bot.activateBlock(ground);
        await sleep(100);
    }
    const soil = bot.blockAt(new Vec3(t.x, p.y, t.z));
    if (!soil || soil.name !== 'farmland') return;
    if (above && above.name === 'beetroots') {
        const age = above.getProperties ? above.getProperties().age : above.metadata;
        if (age < 3) return;
        await bot.dig(above);
    } else if (above && above.name !== 'air') {
        return;
    }
    if (await equipItem(bot, (n) => n === 'beetroot_seeds')) await bot.placeBlock(soil, UP);
    else warn('Tohum bitti');
}

async function run(bot, cfg, log, state) {
    if (!pf || !bot.pathfinder) throw new Error('mineflayer-pathfinder kurulu degil (package.json\'a eklenmeli)');
    const p = plan(cfg.a, cfg.b, cfg.step);
    if (p.tiles.length > 2500) throw new Error('Tarla cok buyuk (en fazla 2500 kare)');
    const need = { hoe: 1, seeds: p.tiles.length - p.points.size, buckets: p.points.size, glow: p.points.size };
    log('Basliyor: ' + p.tiles.length + ' kare, her ' + p.step + ' blokluk bolgeye 1 su + 1 isik (' + p.points.size + ' nokta)');
    log('Gerekli: ' + need.buckets + ' su kovasi, ' + need.glow + ' glowstone, ' + need.seeds + ' tohum, 1 capa');
    await fetchItems(bot, cfg.chest, log, need);
    let done = 0, errors = 0;
    for (const t of p.tiles) {
        if (state.stop) { log('Durduruldu.'); break; }
        try { await doTile(bot, p, t, log); }
        catch (e) { errors++; if (errors <= 5) log('Kare hatasi (' + t.x + ',' + t.z + '): ' + e.message); }
        done++;
        if (done % 50 === 0) log(done + '/' + p.tiles.length + ' kare tamam');
    }
    await depositAll(bot, cfg.chest, log);
    await goNear(bot, cfg.home, 1);
    log('Bitti. Hata sayisi: ' + errors);
}

module.exports = { setup, run, _plan: plan, _doTile: doTile };
