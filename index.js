const express = require('express');
const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require('discord.js');

const app = express();
app.get('/', (req, res) => res.send('🚀 ULTIMATE V16 SUPREME MANAGEMENT BOT IS ONLINE!'));
app.listen(process.env.PORT || 3000);

const PREFIX = '!';
const BOT_OWNER_ID = '1411553847947690076';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const userData = {};
const blacklist = new Set();
const mutedUsers = new Set();
let globalServerMultiplier = 1.0; // Server Event Multiplier

function getUser(id) {
    if (!userData[id]) {
        userData[id] = {
            balance: 10000,
            shells: 0,
            xp: 0,
            level: 1,
            totalCaught: 0,
            rod: 1, boat: 1, bait: 1, weapon: 1, armor: 1, accessory: 1, lake: 1,
            isFishing: false, fishStartTime: 0,
            inventoryFresh: {}, inventoryCooked: {}, lastDaily: 0
        };
    }
    return userData[id];
}

function addXP(p, amount, channel, user) {
    p.xp += Math.floor(amount * globalServerMultiplier);
    let leveledUp = false;
    let oldLevel = p.level;

    while (p.xp >= p.level * 300) {
        p.xp -= p.level * 300;
        p.level++;
        leveledUp = true;
    }

    if (leveledUp && channel) {
        channel.send(`🎊 Chúc mừng **${user.username}** đã thăng lên **Level ${p.level}**!`);
    }
}

function createProgressBar(current, max, size = 10) {
    const percentage = Math.max(0, Math.min(1, current / max));
    const progress = Math.round(size * percentage);
    return '█'.repeat(progress) + '░'.repeat(size - progress) + ` ${Math.floor(percentage * 100)}%`;
}

// KHỞI TẠO DỮ LIỆU
const RODS = {}; for (let i = 1; i <= 40; i++) RODS[i] = { id: i, name: `Cần Cấp ${i} 🎣`, priceXu: i * 3000, priceShell: i >= 30 ? (i - 29) * 500 : 0, luck: i * 3, reqLevel: Math.ceil(i / 2) };
const BOATS = {}; for (let i = 1; i <= 40; i++) BOATS[i] = { id: i, name: `Thuyền ${i} ⛵`, priceXu: i * 4000, priceShell: i >= 25 ? (i - 24) * 600 : 0, capacityBonus: i * 2 };
const BAITS = {}; for (let i = 1; i <= 40; i++) BAITS[i] = { id: i, name: `Mồi Thần ${i} 🐛`, priceXu: i * 1500, priceShell: i >= 30 ? (i - 29) * 300 : 0 };
const WEAPONS = {}; for (let i = 1; i <= 20; i++) WEAPONS[i] = { id: i, name: `Vũ Khí Cấp ${i} ⚔️`, priceXu: i * 6000, priceShell: i * 80, damage: i * 400 };
const ARMORS = {}; for (let i = 1; i <= 20; i++) ARMORS[i] = { id: i, name: `Giáp Boss Cấp ${i} 🛡️`, priceXu: i * 5000, priceShell: i * 60, def: i * 150 };
const ACCESSORIES = {}; for (let i = 1; i <= 20; i++) ACCESSORIES[i] = { id: i, name: `Nhẫn Rồng Cấp ${i} 💍`, priceXu: i * 4500, priceShell: i * 50, critDmg: i * 100 };

let bossLevel = 1;
function createBoss(level) {
    const bossNames = ['Hải Tặc Bán Cá 🏴‍☠️', 'Bạch Tuộc Quỷ 🐙', 'Cá Mập Megalodon 🦈', 'Rồng Biển Khổng Lồ 🐉', 'Thủy Quái Leviathan 🐲', 'Quỷ Vương Biển Sâu 😈'];
    const maxHp = level * 15000;
    return {
        level: level,
        name: `${bossNames[(level - 1) \% bossNames.length]} (Cấp ${level})`,
        maxHp: maxHp, hp: maxHp,
        rewardXu: level * 30000, rewardShell: level * 600, rewardXP: level * 1200,
        img: 'https://media.giphy.com/media/26FmQ6EOvLxp6cWyY/giphy.gif'
    };
}
let currentBoss = createBoss(bossLevel);

const FISH_TYPES = [
    { name: 'Cá Rác 👞', price: 20, xp: 10, chance: 30, emoji: '👞' },
    { name: 'Cá Cơm 🐟', price: 50, xp: 20, chance: 25, emoji: '🐟' },
    { name: 'Cá Mập 🦈', price: 2000, xp: 400, chance: 5, emoji: '🦈' },
    { name: 'Thủy Quái Leviathan 🐲', price: 60000, xp: 6000, chance: 0.5, emoji: '🐲' }
];

function generateShopEmbed(type, page) {
    const itemsPerPage = 8;
    let items = RODS, title = '🎣 SHOP CẦN CÂU (1-40)';
    if (type === 'boat') { items = BOATS; title = '⛵ SHOP THUYỀN CÂU (1-40)'; }
    if (type === 'bait') { items = BAITS; title = '🐛 SHOP MỒI CÂU (1-40)'; }
    if (type === 'weapon') { items = WEAPONS; title = '⚔️ SHOP VŨ KHÍ (1-20)'; }
    if (type === 'armor') { items = ARMORS; title = '🛡️ SHOP GIÁP BOSS (1-20)'; }
    if (type === 'acc') { items = ACCESSORIES; title = '💍 SHOP PHỤ KIỆN (1-20)'; }

    const totalKeys = Object.keys(items);
    const maxPages = Math.ceil(totalKeys.length / itemsPerPage);
    page = Math.max(1, Math.min(page, maxPages));
    const start = (page - 1) * itemsPerPage;
    const currentKeys = totalKeys.slice(start, start + itemsPerPage);

    let text = `**Trang ${page} /${maxPages}**\n\n`;
    currentKeys.forEach(k => {
        const item = items[k];
        text += `• **ID ${item.id}**:${item.name}\n  └ Giá: \`${item.priceXu.toLocaleString()} Xu\` + \`${item.priceShell.toLocaleString()} 🦪 Sò\`\n`;
    });

    text += `\n👉 *Cách trang bị nhanh: \`!trangbi c1\`, \`!trangbi v5\`, \`!trangbi g2\`, \`!trangbi p3\`*`;

    const embed = new EmbedBuilder().setColor('#f39c12').setTitle(title).setDescription(text);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`shop_${type}_${page - 1}`).setLabel('⏪ Trang trước').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId(`shop_${type}_${page + 1}`).setLabel('Trang sau ⏩').setStyle(ButtonStyle.Primary).setDisabled(page === maxPages)
    );
    return { embeds: [embed], components: [row] };
}

function generateControlPanel(user, p) {
    const embed = new EmbedBuilder()
        .setColor('#00ffff')
        .setTitle(`🎮 BẢNG ĐIỀU KHIỂN VIP V16 - ${user.username}`)
        .setDescription(
            `🪙 **Xu:** \`${p.balance.toLocaleString()}\` | 🦪 **Sò:** \`${p.shells.toLocaleString()}\` | ⭐ **Level:** \`${p.level}\` (${p.xp} XP)\n` +
            `🔥 **Hệ số Event Server:** \`x${globalServerMultiplier}\` Bonus!\n` +
            `🎣 **Cần:** ${RODS[p.rod].name} \vert{} ⛵ **Thuyền:** ${BOATS[p.boat].name}\n` +
            `⚔️ **Vũ khí:** ${WEAPONS[p.weapon].name} \vert{} 🛡️ **Giáp:** ${ARMORS[p.armor].name}\n` +
            `💍 **Phụ kiện:** ${ACCESSORIES[p.accessory].name}\n\n` +
            `👾 **Boss Server:** Cấp ${currentBoss.level} (${currentBoss.hp}/${currentBoss.maxHp} HP)\n` +
            `👇 *Nhấn các nút bấm bên dưới để thao tác:*`
        )
        .setThumbnail(user.displayAvatarURL());

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('act_start').setLabel('🎣 Thả Cần').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('act_stop').setLabel('🛑 Giật Cần').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('act_chebien').setLabel('🍳 Chế Biến').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('act_banhet').setLabel('💰 Bán Tất Cả').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('act_danhboss').setLabel('⚔️ Đánh Boss').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('act_khoca').setLabel('🎒 Kho Đồ').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('act_daily').setLabel('🎁 Điểm Danh').setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row1, row2] };
}

client.on('ready', () => console.log(`✅ Ultimate V16 Supreme Management Bot Ready: ${client.user.tag}`));

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const user = message.author;

    // KIỂM TRA BLACKLIST
    if (blacklist.has(user.id)) {
        return message.reply('⛔ **BẠN ĐÃ BỊ CHỦ BOT BAN VĨNH VIỄN KHỎI HỆ THỐNG!**');
    }

    if (mutedUsers.has(user.id)) {
        return message.reply('🔇 Bạn đang bị Admin khóa thao tác với Bot!');
    }

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const p = getUser(user.id);

    // 1. NHÓM LỆNH QUYỀN NĂNG TỐI CAO CHỦ BOT (BOT OWNER ONLY)
    if (['godmode', 'buffall', 'setxu', 'setso', 'banbot', 'unbanbot', 'event', 'giveca', 'clearca', 'setbosslevel', 'killboss', 'system', 'eval'].includes(command)) {
        if (user.id !== BOT_OWNER_ID) return message.reply('⛔ **LỆNH CẤM!** Dành riêng cho Chủ Bot (ID: 1411553847947690076)!');
        const targetUser = message.mentions.users.first();
        const targetP = targetUser ? getUser(targetUser.id) : null;

        if (command === 'godmode') {
            p.balance = 999999999; p.shells = 999999999;
            p.rod = 40; p.boat = 40; p.bait = 40; p.weapon = 20; p.armor = 20; p.accessory = 20; p.level = 100;
            return message.reply('⚡ **[GOD MODE ACTIVATED]** Nhận Full Đồ Max 40/20 Cấp & 999,999,999 Xu/Sò!');
        }

        if (command === 'banbot' && targetUser) {
            blacklist.add(targetUser.id);
            return message.reply(`⛔ **[BOT OWNER]** Đã **BAN** người chơi **${targetUser.username}** vĩnh viễn khỏi Bot!`);
        }

        if (command === 'unbanbot' && targetUser) {
            blacklist.delete(targetUser.id);
            return message.reply(`✅ **[BOT OWNER]** Đã **UNBAN** cho người chơi **${targetUser.username}**!`);
        }

        if (command === 'event') {
            const mult = parseFloat(args[0]) || 1.0;
            globalServerMultiplier = mult;
            return message.reply(`🎉 **[BOT OWNER]** Đã kích hoạt **SỰ KIỆN X${mult} SERVER** (Tăng x${mult} Xu & XP)!`);
        }

        if (command === 'giveca' && targetUser) {
            const fishName = args[1] || 'Thủy Quái Leviathan 🐲';
            const amount = parseInt(args[2]) || 1;
            targetP.inventoryFresh[fishName] = (targetP.inventoryFresh[fishName] || 0) + amount;
            return message.reply(`🎉 **[BOT OWNER]** Đã bơm **${amount}x${fishName}** vào kho của **${targetUser.username}**!`);
        }

        if (command === 'clearca' && targetUser) {
            targetP.inventoryFresh = {}; targetP.inventoryCooked = {};
            return message.reply(`🧹 **[BOT OWNER]** Đã xói sạch kho cá của **${targetUser.username}**!`);
        }

        if (command === 'buffall') {
            const xu = parseInt(args[0]) || 0, so = parseInt(args[1]) || 0;
            Object.keys(userData).forEach(id => { userData[id].balance += xu; userData[id].shells += so; });
            return message.reply(`🎉 **[BOT OWNER]** Bơm **+${xu.toLocaleString()} Xu** & **+${so.toLocaleString()} Sò** cho TOÀN BỘ server!`);
        }

        if (command === 'setxu' && targetP) { targetP.balance = parseInt(args[1]) || 0; return message.reply(`🔥 Set Xu thành công!`); }
        if (command === 'setso' && targetP) { targetP.shells = parseInt(args[1]) || 0; return message.reply(`🔥 Set Sò thành công!`); }
        if (command === 'setbosslevel') { bossLevel = Math.max(1, parseInt(args[0]) || 1); currentBoss = createBoss(bossLevel); return message.reply(`🔥 Nhảy Boss Cấp ${bossLevel}!`); }
        if (command === 'killboss') { bossLevel++; currentBoss = createBoss(bossLevel); return message.reply(`⚡ Kết liễu Boss! Boss mới: **${currentBoss.name}**!`); }
        if (command === 'system') return message.reply(`💻 RAM: \`${(process.memoryUsage().heapUsed/1024/1024).toFixed(2)} MB\` | Users: \`${Object.keys(userData).length}\` | Blacklist: \`${blacklist.size}\``);
        if (command === 'eval') { try { return message.reply(````javascript\n${eval(args.join(' '))}\n````); } catch (e) { return message.reply(`❌ Lỗi: ${e.message}`); } }
    }

    // 2. NHÓM LỆNH ADMIN MÁY CHỦ PRO
    if (['congxu', 'truxu', 'congso', 'truso', 'setlevel', 'resetboss', 'clearuser', 'muteplayer', 'unmuteplayer', 'soica'].includes(command)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && user.id !== BOT_OWNER_ID) return;
        const targetUser = message.mentions.users.first();
        const targetP = targetUser ? getUser(targetUser.id) : null;

        if (command === 'muteplayer' && targetUser) {
            mutedUsers.add(targetUser.id);
            return message.reply(`🔇 Đã khóa thao tác dùng Bot của **${targetUser.username}**!`);
        }

        if (command === 'unmuteplayer' && targetUser) {
            mutedUsers.delete(targetUser.id);
            return message.reply(`🔊 Đã mở khóa thao tác cho **${targetUser.username}**!`);
        }

        if (command === 'soica' && targetUser) {
            const embed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle(`🔍 TRINTH THÁM TÀI KHOẢN - ${targetUser.username}`)
                .setDescription(
                    `🪙 **Xu:** \`${targetP.balance.toLocaleString()}\` Xu\n` +
                    `🦪 **Sò:** \`${targetP.shells.toLocaleString()}\` Sò\n` +
                    `⭐ **Level:** \`${targetP.level}\` (${targetP.xp} XP)\n` +
                    `🎣 **Cần:** ID ${targetP.rod} | ⛵ **Thuyền:** ID ${targetP.boat} \vert{} 🐛 **Mồi:** ID ${targetP.bait}\n` +
                    `⚔️ **Vũ khí:** ID ${targetP.weapon} | 🛡️ **Giáp:** ID ${targetP.armor} \vert{} 💍 **Phụ kiện:** ID ${targetP.accessory}`
                );
            return message.channel.send({ embeds: [embed] });
        }

        if (command === 'congxu' && targetP) { targetP.balance += parseInt(args[1]) || 0; return message.reply(`✅ Đã cộng Xu!`); }
        if (command === 'congso' && targetP) { targetP.shells += parseInt(args[1]) || 0; return message.reply(`✅ Đã cộng Sò!`); }
        if (command === 'setlevel' && targetP) { targetP.level = parseInt(args[1]) || 1; return message.reply(`✅ Đã chỉnh Level!`); }
        if (command === 'resetboss') { bossLevel = 1; currentBoss = createBoss(1); return message.reply('✅ Reset Boss Cấp 1!'); }
        if (command === 'clearuser' && targetUser) { delete userData[targetUser.id]; return message.reply(`✅ Đã xóa user!`); }
    }

    // 3. CASINO GAME
    if (command === 'taixiu') {
        const choice = (args[0] || '').toLowerCase(), bet = parseInt(args[1]) || 0;
        if (!['tai', 'xiu'].includes(choice) || bet <= 0) return message.reply('❌ `!taixiu tai <tiền>` hoặc `!taixiu xiu <tiền>`');
        if (p.balance < bet) return message.reply('❌ Không đủ Xu!');

        const d1 = Math.floor(Math.random() * 6) + 1, d2 = Math.floor(Math.random() * 6) + 1, d3 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2 + d3, result = total >= 11 ? 'tai' : 'xiu';

        if (choice === result) { p.balance += Math.floor(bet * globalServerMultiplier); return message.reply(`🎲 Kết quả: **${d1}-${d2}-${d3}** (${total} ➔ **${result.toUpperCase()}**)\n🎉 Thắng **+${Math.floor(bet * globalServerMultiplier).toLocaleString()} Xu**!`); }
        else { p.balance -= bet; return message.reply(`🎲 Kết quả: **${d1}-${d2}-${d3}** (${total} ➔ **${result.toUpperCase()}**)\n😭 Thua **-${bet.toLocaleString()} Xu**!`); }
    }

    // 4. MUA VÀ TRẠNG BỊ NHANH
    if (command === 'trangbi') {
        const rawCode = (args[0] || '').toLowerCase(), typeChar = rawCode.charAt(0), idNum = parseInt(rawCode.slice(1));
        if (isNaN(idNum)) return message.reply('❌ Dùng: `!trangbi c1`, `!trangbi v5`, `!trangbi g2`, `!trangbi p3`');

        if (typeChar === 'c' && RODS[idNum]) { p.rod = idNum; return message.reply(`🎉 Đã mặc **${RODS[idNum].name}**!`); }
        if (typeChar === 'v' && WEAPONS[idNum]) { p.weapon = idNum; return message.reply(`🎉 Đã mặc **${WEAPONS[idNum].name}**!`); }
        if (typeChar === 'g' && ARMORS[idNum]) { p.armor = idNum; return message.reply(`🎉 Đã mặc **${ARMORS[idNum].name}**!`); }
        if (typeChar === 'p' && ACCESSORIES[idNum]) { p.accessory = idNum; return message.reply(`🎉 Đã mặc **${ACCESSORIES[idNum].name}**!`); }
        return message.reply('❌ Mã trang bị không đúng!');
    }

    // 5. GAME THƯỜNG, MENU, SHOP, BOSS
    if (command === 'menu' || command === 'dashboard') return message.channel.send(generateControlPanel(user, p));
    if (command === 'top' || command === 'bxh') {
        const sorted = Object.keys(userData).map(id => ({ id, ...userData[id] })).sort((a, b) => b.balance - a.balance).slice(0, 5);
        let txt = '🏆 **TOP 5 ĐẠI GIA SERVER**\n\n';
        sorted.forEach((u, i) => { txt += `**#${i + 1}** <@${u.id}> - \`${u.balance.toLocaleString()} Xu\` | \`${u.shells.toLocaleString()} 🦪 Sò\` (Lv ${u.level})\n`; });
        return message.channel.send({ embeds: [new EmbedBuilder().setColor('#f1c40f').setTitle('📊 BẢNG XẾP HẠNG SERVER').setDescription(txt)] });
    }

    if (command === 'shoprod') return message.channel.send(generateShopEmbed('rod', 1));
    if (command === 'shopboat') return message.channel.send(generateShopEmbed('boat', 1));
    if (command === 'shopbait') return message.channel.send(generateShopEmbed('bait', 1));
    if (command === 'shopboss') return message.channel.send(generateShopEmbed('weapon', 1));
    if (command === 'shopgiap') return message.channel.send(generateShopEmbed('armor', 1));
    if (command === 'shopphukien') return message.channel.send(generateShopEmbed('acc', 1));

    if (command === 'boss') {
        const hpBar = createProgressBar(currentBoss.hp, currentBoss.maxHp);
        const embed = new EmbedBuilder().setColor('#e74c3c').setTitle(`👾 BOSS SERVER CẤP ${currentBoss.level}:${currentBoss.name}`).setDescription(`❤️ **HP:** \`[${hpBar}]\` (${currentBoss.hp}/${currentBoss.maxHp})\n🪙 **Xu:** \`+${Math.floor(currentBoss.rewardXu * globalServerMultiplier).toLocaleString()}\` | 🦪 **Sò:** \`+${currentBoss.rewardShell.toLocaleString()}\` | ⭐ **XP:** \`+${currentBoss.rewardXP.toLocaleString()}\``).setImage(currentBoss.img);
        return message.channel.send({ embeds: [embed] });
    }

    if (command === 'danhboss') {
        const w = WEAPONS[p.weapon] || WEAPONS[1];
        const acc = ACCESSORIES[p.accessory] || ACCESSORIES[1];
        const totalDmg = w.damage + acc.critDmg + (p.level * 30);
        currentBoss.hp -= totalDmg;

        let replyMsg = `⚔️ **${user.username}** chém Boss **-${totalDmg} SMC**!\n❤️ HP Boss còn: \`${Math.max(0, currentBoss.hp)} / ${currentBoss.maxHp}\``;

        if (currentBoss.hp <= 0) {
            const winXu = Math.floor(currentBoss.rewardXu * globalServerMultiplier);
            p.balance += winXu; p.shells += currentBoss.rewardShell;
            addXP(p, currentBoss.rewardXP, message.channel, user);
            replyMsg += `\n\n🎉 **BẠN ĐÃ TIÊU DIỆT BOSS CẤP ${currentBoss.level}!**\n🎁 Thưởng: +${winXu.toLocaleString()} Xu, +${currentBoss.rewardShell.toLocaleString()} Sò & +${currentBoss.rewardXP.toLocaleString()} XP!`;
            bossLevel++; currentBoss = createBoss(bossLevel);
            replyMsg += `\n🔥 **BOSS MỚI:** **${currentBoss.name}**!`;
        }
        return message.channel.send(replyMsg);
    }
});

// BUTTON INTERACTION
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const user = interaction.user;
    if (blacklist.has(user.id) || mutedUsers.has(user.id)) return interaction.reply({ content: '⛔ Bạn bị cấm thao tác!', ephemeral: true });

    const p = getUser(user.id);
    const id = interaction.customId;

    if (id.startsWith('shop_')) {
        const [_, type, pageStr] = id.split('_');
        return interaction.update(generateShopEmbed(type, parseInt(pageStr)));
    }

    if (id === 'act_danhboss') {
        const w = WEAPONS[p.weapon] || WEAPONS[1];
        const acc = ACCESSORIES[p.accessory] || ACCESSORIES[1];
        const totalDmg = w.damage + acc.critDmg + (p.level * 30);

        currentBoss.hp -= totalDmg;
        let responseMsg = `⚔️ Bạn chém Boss **-${totalDmg} HP**! (HP còn: ${Math.max(0, currentBoss.hp)})`;

        if (currentBoss.hp <= 0) {
            const winXu = Math.floor(currentBoss.rewardXu * globalServerMultiplier);
            p.balance += winXu; p.shells += currentBoss.rewardShell;
            addXP(p, currentBoss.rewardXP, interaction.channel, user);
            responseMsg = `🎉 **DIỆT BOSS CẤP ${currentBoss.level}!** +${winXu.toLocaleString()} Xu, +${currentBoss.rewardShell.toLocaleString()} Sò & +${currentBoss.rewardXP.toLocaleString()} XP!`;
            bossLevel++; currentBoss = createBoss(bossLevel);
            responseMsg += `\n🔥 **BOSS MỚI:** ${currentBoss.name}!`;
        }
        return interaction.reply({ content: responseMsg, ephemeral: false });
    }

    if (id === 'act_khoca') {
        const nextLvXp = p.level * 300;
        const xpBar = createProgressBar(p.xp, nextLvXp);
        const embed = new EmbedBuilder().setColor('#2ecc71').setTitle(`🎒 KHO ĐỒ - ${user.username}`).setDescription(`🪙 **Xu:** \`${p.balance.toLocaleString()}\` | 🦪 **Sò:** \`${p.shells.toLocaleString()}\`\n⭐ **Level:** \`${p.level}\` \`[${xpBar}]\` (${p.xp}/${nextLvXp} XP)\n🎣 **Cần:** ${RODS[p.rod].name}\n⚔️ **Vũ khí:** ${WEAPONS[p.weapon].name}\n🛡️ **Giáp:** ${ARMORS[p.armor].name}\n💍 **Phụ kiện:** ${ACCESSORIES[p.accessory].name}`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
});

client.login(process.env.TOKEN);
