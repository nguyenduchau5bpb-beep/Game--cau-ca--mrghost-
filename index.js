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
app.get('/', (req, res) => res.send('🚀 ULTIMATE V20.0 - 1000 SPECIES EDITION IS ONLINE!'));
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

let userData = {};
const blacklist = new Set();
const mutedUsers = new Set();
let globalServerMultiplier = 1.0;

function getUser(id) {
    if (!userData[id]) {
        userData[id] = {
            balance: 10000,
            shells: 0,
            xp: 0,
            level: 1,
            rod: 1, boat: 1, bait: 1, weapon: 1, armor: 1, accessory: 1,
            lastDaily: 0,
            fishBag: [] // Kho chứa từng con cá
        };
    }
    return userData[id];
}

function addXP(p, amount, channel, user) {
    p.xp += Math.floor(amount * globalServerMultiplier);
    let leveledUp = false;
    while (p.xp >= p.level * 300) {
        p.xp -= p.level * 300;
        p.level++;
        leveledUp = true;
    }
    if (leveledUp && channel) {
        channel.send(`🎊 Chúc mừng **${user.username}** đã thăng lên **Level ${p.level}**! Tăng sát thương chém Boss!`);
    }
}

// ==========================================
// 🐟 THUẬT TOÁN GENERATE 1,000+ LOẠI CÁ
// ==========================================
const FISH_PREFIXES = ['Biển Sâu', 'Băng Giá', 'Hỏa Ngục', 'Bão Tố', 'Cổ Đại', 'Hoàng Kim', 'Huyết Tộc', 'Thần Thoại', 'Bóng Đêm', 'Ánh Sáng', 'Vẫn Thạch', 'Tử Cấm', 'Huyền Thoại', 'Tinh Tú', 'Hắc Sâm'];
const FISH_BASE_NAMES = ['Cá Chép', 'Cá Mập', 'Cá Rồng', 'Cá Ngừ', 'Cá Voi', 'Cá Vược', 'Cá Hồi', 'Cá Đuối', 'Cá Hố', 'Cá Chim', 'Cá Thu', 'Cá Cương', 'Cá La Hán', 'Cá Kiếm', 'Cá Hải Tượng', 'Cá Sấu Biển', 'Cá Bơn', 'Cá Hề', 'Cá Mút Đá', 'Cá Thần Tiên'];
const FISH_SUFFIXES = ['Bạo Vương', 'Thánh Thú', 'U Linh', 'Chúa Tể', 'Thần Trùng', 'Thiên Vương', 'Hải Quy', 'Yêu Ma', 'Thần Long', 'Huyết Biển'];

// Tạo ngẫu nhiên 1 loài cá trong danh sách 1,000+ cá
function catchRandomFish() {
    const pFixed = FISH_PREFIXES[Math.floor(Math.random() * FISH_PREFIXES.length)];
    const bFixed = FISH_BASE_NAMES[Math.floor(Math.random() * FISH_BASE_NAMES.length)];
    const sFixed = FISH_SUFFIXES[Math.floor(Math.random() * FISH_SUFFIXES.length)];
    const fishName = `${bFixed} ${pFixed}${sFixed}`;

    const rand = Math.random();
    let rarity = 'D';
    let value = 200;

    if (rand < 0.01) { rarity = 'SSS'; value = 50000; }      // 1% Cá Siêu Thần Thoại
    else if (rand < 0.05) { rarity = 'SS'; value = 15000; }  // 4% Cá Cực Hiếm
    else if (rand < 0.15) { rarity = 'S'; value = 5000; }    // 10% Cá Hiếm
    else if (rand < 0.35) { rarity = 'A'; value = 2000; }    // 20% Cá Cao Cấp
    else if (rand < 0.65) { rarity = 'B'; value = 1000; }    // 30% Cá Trung Cấp
    else if (rand < 0.85) { rarity = 'C'; value = 500; }     // 20% Cá Thường
    else { rarity = 'D'; value = 200; }                      // 15% Cá Rác

    return { name: fishName, rarity: rarity, price: value };
}

// TRANG BỊ
const RODS = {}; for (let i = 1; i <= 40; i++) RODS[i] = { id: i, name: `Cần Cấp ${i} 🎣` };
const WEAPONS = {}; for (let i = 1; i <= 20; i++) WEAPONS[i] = { id: i, name: `Vũ Khí Cấp ${i} ⚔️`, damage: i * 400 };

// BOSS SERVER
let bossLevel = 1;
function createBoss(level) {
    const bossNames = ['Hải Tặc Bắn Cá', 'Bạch Tuộc Quỷ', 'Cá Mập Megalodon', 'Rồng Biển Khổng Lồ', 'Thủy Quái Leviathan', 'Quỷ Vương Biển Sâu'];
    const maxHp = 2000 + (level - 1) * 6000;
    const nameIndex = (level - 1) % bossNames.length;
    return {
        level: level, name: `${bossNames[nameIndex]} (Cấp ${level})`,
        maxHp: maxHp, hp: maxHp,
        rewardXu: level * 20000, rewardShell: level * 400, rewardXP: level * 1000,
        img: 'https://media.giphy.com/media/26FmQ6EOvLxp6cWyY/giphy.gif'
    };
}
let currentBoss = createBoss(bossLevel);

client.on('ready', () => console.log(`✅ ULTIMATE V20.0 READY: ${client.user.tag}`));

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const user = message.author;
    if (blacklist.has(user.id)) return message.reply('⛔ **BẠN ĐÃ BỊ CẤM KHỎI HỆ THỐNG!**');
    if (mutedUsers.has(user.id)) return message.reply('🔇 Bạn đang bị khóa thao tác!');

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const p = getUser(user.id);

    // ==========================================
    // 📖 MENU HƯỚNG DẪN & CONTROL PANEL
    // ==========================================
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('📖 TỔNG HỢP HƯỚNG DẪN V20.0 (1,000+ CÁ)')
            .setDescription(
                `🚀 **CƠ BẢN & CÂU CÁ:**\n` +
                `• \`!start\` / \`!menu\` - Bảng điều khiển nút bấm\n` +
                `• \`!khoca\` - Xem kho chứa 1,000+ loại cá theo Phẩm Cấp (SSS, SS, S, A, B, C, D)\n` +
                `• \`!banca\` - Bán toàn bộ cá trong kho lấy Xu\n` +
                `• \`!daily\` - Điểm danh nhận tiền hàng ngày\n\n` +
                `🎰 **MINI-GAME GIẢI TRÍ:**\n` +
                `• \`!taixiu <tai/xiu> <tiền>\` - Chơi Tài Xỉu\n` +
                `• \`!slot <tiền>\` - Quay Slot Machine\n` +
                `• \`!choido @user\` - Cướp tiền người chơi\n\n` +
                `🛡️ **ADMIN & OWNER:** Gõ \`!admin\` để xem dàn 15+ lệnh quản trị tối cao.`
            );
        return message.channel.send({ embeds: [embed] });
    }

    if (command === 'start' || command === 'menu') {
        const embed = new EmbedBuilder()
            .setColor('#00ffff')
            .setTitle(`🎮 BOT CONTROL PANEL - ${user.username}`)
            .setDescription(
                `🪙 **Xu:** \`${p.balance.toLocaleString()}\` | 🦪 **Sò:** \`${p.shells.toLocaleString()}\` | ⭐ **Lv:** \`${p.level}\`\n` +
                `🐟 **Cá trong kho:** \`${p.fishBag.length}\` con\n` +
                `👾 **Boss Server:** Cấp ${currentBoss.level} (${currentBoss.hp.toLocaleString()}/${currentBoss.maxHp.toLocaleString()} HP)`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('act_start').setLabel('🎣 Thả Cần Câu Cá').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('act_danhboss').setLabel('⚔️ Đánh Boss').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('act_khoca').setLabel('🎒 Kho Cá').setStyle(ButtonStyle.Secondary)
        );
        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // ==========================================
    // 🎒 HỆ THỐNG KHO CÁ & BÁN CÁ
    // ==========================================
    if (command === 'khoca') {
        if (p.fishBag.length === 0) return message.reply('🎒 Kho cá của bạn hiện đang trống! Hãy thả cần câu cá ngay (`!start`).');
        
        let totalValue = 0;
        const counts = { SSS: 0, SS: 0, S: 0, A: 0, B: 0, C: 0, D: 0 };
        
        p.fishBag.forEach(f => {
            totalValue += f.price;
            counts[f.rarity] = (counts[f.rarity] || 0) + 1;
        });

        const recentFish = p.fishBag.slice(-3).map(f => `• [${f.rarity}] **${f.name}** (${f.price.toLocaleString()} Xu)`).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`🎒 KHO CÁ TRONG TỔNG SỐ 1,000+ LOÀI - ${user.username}`)
            .setDescription(
                `📊 **Tổng số cá:** \`${p.fishBag.length}\` con | 💰 **Giá trị kho:** \`${totalValue.toLocaleString()} Xu\`\n\n` +
                `🌟 **Thống kê Phẩm Cấp:**\n` +
                `👑 **SSS (Thần Thoại):** \`${counts.SSS}\` | 💎 **SS:** \`${counts.SS}\` | ⭐ **S:** \`${counts.S}\` | 🟣 **A:** \`${counts.A}\` | 🔵 **B:** \`${counts.B}\` | 🟢 **C:** \`${counts.C}\` | ⚪ **D:** \`${counts.D}\`\n\n` +
                `🐟 **Cá vừa câu gần đây:**\n${recentFish}\n\n` +
                `💡 *Gõ \`!banca\` để bán toàn bộ lấy tiền Xu!*`
            );
        return message.channel.send({ embeds: [embed] });
    }

    if (command === 'banca') {
        if (p.fishBag.length === 0) return message.reply('❌ Trong kho không có con cá nào để bán!');
        const totalEarned = p.fishBag.reduce((sum, f) => sum + f.price, 0);
        const count = p.fishBag.length;
        p.balance += totalEarned;
        p.fishBag = []; // Xóa cá khỏi kho
        return message.reply(`💰 Bạn đã bán **${count} con cá** và thu về **+${totalEarned.toLocaleString()} Xu**!`);
    }

    // ==========================================
    // 👑 BẢNG LỆNH ADMIN & OWNER THỦ CÔNG & TỰ ĐỘNG
    // ==========================================
    if (command === 'admin') {
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator) || user.id === BOT_OWNER_ID;
        if (!isAdmin) return message.reply('❌ Bạn không có quyền Admin!');

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🛡️ BẢNG QUẢN TRỊ ADMIN & OWNER V20.0')
            .setDescription(
                `👑 **QUYỀN HẠN CHỦ BOT (BOT OWNER):**\n` +
                `• \`!eval <code>\` - Chạy lệnh Javascript hệ thống trực tiếp\n` +
                `• \`!godmode\` - Vô địch, Max Trang Bị & 999M Xu/Sò\n` +
                `• \`!resetall\` - WIPE/Xóa dữ liệu toàn server\n` +
                `• \`!resetdata @user\` - Reset tài khoản của 1 người chơi\n` +
                `• \`!setall @user <xu> <sò> <level>\` - Set chỉ số tùy ý\n` +
                `• \`!givefish @user <SSS/SS/S/A/B/C/D>\` - Bơm cá hiếm\n` +
                `• \`!spawnboss <level>\` - Triệu hồi Boss level tùy chọn\n` +
                `• \`!event <hệ_số>\` - Bật Event X2, X3, X5 toàn server\n` +
                `• \`!buffall <xu> <sò>\` - Bơm tiền toàn máy chủ\n` +
                `• \`!banbot @user\` / \`!unbanbot @user\` - Ban/Unban người chơi\n` +
                `• \`!killboss\` - Tiêu diệt Boss | \`!system\` - Check RAM\n\n` +
                `🛡️ **QUYỀN HẠN ADMIN SERVER:**\n` +
                `• \`!congxu @user <số>\` / \`!truxu @user <số>\` - Cộng/Trừ Xu\n` +
                `• \`!congso @user <số>\` / \`!truso @user <số>\` - Cộng/Trừ Sò\n` +
                `• \`!muteplayer @user\` / \`!unmuteplayer @user\` - Khóa chat\n` +
                `• \`!soica @user\` - Soi toàn bộ tài sản người chơi\n` +
                `• \`!clear <số_lượng>\` - Xóa tin nhắn rác`
            );
        return message.channel.send({ embeds: [embed] });
    }

    // LỆNH RIÊNG CHỦ BOT (OWNER ONLY)
    if (['eval', 'godmode', 'resetall', 'resetdata', 'setall', 'givefish', 'spawnboss', 'event', 'buffall', 'banbot', 'unbanbot', 'killboss', 'system'].includes(command)) {
        if (user.id !== BOT_OWNER_ID) return message.reply('⛔ Dành riêng cho Chủ Bot!');
        
        const targetUser = message.mentions.users.first();
        const targetP = targetUser ? getUser(targetUser.id) : null;

        if (command === 'eval') {
            try {
                let evaled = eval(args.join(' '));
                if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
                return message.reply(`\`\`\`js\n${evaled}\n\`\`\``);
            } catch (err) { return message.reply(`\`\`\`js\n${err}\n\`\`\``); }
        }
        if (command === 'godmode') {
            p.balance = 999999999; p.shells = 999999999; p.rod = 40; p.weapon = 20; p.level = 100;
            return message.reply('⚡ **[GOD MODE ACTIVATED]** Bạn đã nhận Max Đồ & 999M Xu/Sò!');
        }
        if (command === 'resetall') { userData = {}; return message.reply('💥 **WIPE DATA SUCCESS!**'); }
        if (command === 'resetdata' && targetUser) { delete userData[targetUser.id]; return message.reply(`🧹 Đã xóa sạch dữ liệu của **${targetUser.username}**!`); }
        if (command === 'setall' && targetP) {
            targetP.balance = parseInt(args[1]) || 0;
            targetP.shells = parseInt(args[2]) || 0;
            targetP.level = parseInt(args[3]) || 1;
            return message.reply(`🔥 Đã set toàn bộ chỉ số cho **${targetUser.username}**!`);
        }
        if (command === 'givefish' && targetP) {
            const rarity = (args[1] || 'SSS').toUpperCase();
            const customFish = { name: `Cá Hoàng Gia Cổ Đại [GIFT]`, rarity: rarity, price: rarity === 'SSS' ? 100000 : 20000 };
            targetP.fishBag.push(customFish);
            return message.reply(`🎁 Đã tặng 1 con cá phẩm **[${rarity}]** cho **${targetUser.username}**!`);
        }
        if (command === 'spawnboss') {
            bossLevel = parseInt(args[0]) || 1;
            currentBoss = createBoss(bossLevel);
            return message.reply(`🔥 **TRIỆU HỒI BOSS:** **${currentBoss.name}** (${currentBoss.hp.toLocaleString()} HP)!`);
        }
        if (command === 'event') { globalServerMultiplier = parseFloat(args[0]) || 1.0; return message.reply(`🎉 Kích hoạt **EVENT X${globalServerMultiplier} SERVER**!`); }
        if (command === 'buffall') { const xu = parseInt(args[0]) || 0, so = parseInt(args[1]) || 0; Object.keys(userData).forEach(id => { userData[id].balance += xu; userData[id].shells += so; }); return message.reply(`🎉 Bơm tiền cho toàn server!`); }
        if (command === 'banbot' && targetUser) { blacklist.add(targetUser.id); return message.reply(`⛔ Đã BAN **${targetUser.username}**!`); }
        if (command === 'unbanbot' && targetUser) { blacklist.delete(targetUser.id); return message.reply(`✅ Đã UNBAN cho **${targetUser.username}**!`); }
        if (command === 'killboss') { bossLevel++; currentBoss = createBoss(bossLevel); return message.reply(`⚡ Kết liễu Boss!`); }
        if (command === 'system') return message.reply(`💻 RAM: \`${(process.memoryUsage().heapUsed/1024/1024).toFixed(2)} MB\` | Users: \`${Object.keys(userData).length}\``);
    }

    // LỆNH ADMIN SERVER
    if (['congxu', 'truxu', 'congso', 'truso', 'muteplayer', 'unmuteplayer', 'soica', 'clear'].includes(command)) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && user.id !== BOT_OWNER_ID) return message.reply('❌ Bạn không có quyền Admin!');
        const targetUser = message.mentions.users.first();
        const targetP = targetUser ? getUser(targetUser.id) : null;

        if (command === 'congxu' && targetP) { targetP.balance += parseInt(args[1]) || 0; return message.reply(`✅ Đã cộng Xu!`); }
        if (command === 'truxu' && targetP) { targetP.balance = Math.max(0, targetP.balance - (parseInt(args[1]) || 0)); return message.reply(`✅ Đã trừ Xu!`); }
        if (command === 'muteplayer' && targetUser) { mutedUsers.add(targetUser.id); return message.reply(`🔇 Đã khóa **${targetUser.username}**!`); }
        if (command === 'unmuteplayer' && targetUser) { mutedUsers.delete(targetUser.id); return message.reply(`🔊 Đã mở khóa cho **${targetUser.username}**!`); }
        if (command === 'soica' && targetUser) {
            return message.reply(`🎒 **Hồ sơ ${targetUser.username}:**\n🪙 Xu: \`${targetP.balance.toLocaleString()}\` | 🦪 Sò: \`${targetP.shells.toLocaleString()}\` | 🐟 Cá trong kho: \`${targetP.fishBag.length}\` con`);
        }
        if (command === 'clear') {
            const amount = parseInt(args[0]) || 10;
            await message.channel.bulkDelete(Math.min(amount, 100), true);
            return message.channel.send(`🧹 Đã xóa **${amount} tin nhắn**!`).then(m => setTimeout(() => m.delete(), 3000));
        }
    }

    // MINIGAME
    if (command === 'daily') {
        const now = Date.now();
        if (now - p.lastDaily < 86400000) return message.reply('⏰ Hôm nay bạn đã điểm danh rồi!');
        p.lastDaily = now;
        p.balance += 20000;
        return message.reply(`🎁 **ĐIỂM DANH!** Bạn nhận **+20,000 Xu**!`);
    }

    if (command === 'taixiu' || command === 'tx') {
        const choice = args[0]?.toLowerCase(), bet = parseInt(args[1]);
        if (!['tai', 'xiu'].includes(choice) || isNaN(bet) || bet <= 0) return message.reply('❌ Cú pháp: `!taixiu <tai/xiu> <tiền>`');
        if (p.balance < bet) return message.reply('❌ Không đủ Xu!');

        const d1 = Math.floor(Math.random() * 6) + 1, d2 = Math.floor(Math.random() * 6) + 1, d3 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2 + d3, result = total >= 11 ? 'tai' : 'xiu';

        p.balance -= bet;
        if (choice === result) { p.balance += bet * 2; return message.reply(`🎲 Kết quả: **${d1}-${d2}-${d3}** (${total} -> **${result.toUpperCase()}**)\n🎉 Thắng **+${(bet * 2).toLocaleString()} Xu**!`); }
        else { return message.reply(`🎲 Kết quả: **${d1}-${d2}-${d3}** (${total} -> **${result.toUpperCase()}**)\n💸 Thua **-${bet.toLocaleString()} Xu**!`); }
    }
});

// INTERACTION BUTTONS
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const user = interaction.user;
    const p = getUser(user.id);

    if (interaction.customId === 'act_start') {
        const caughtFish = catchRandomFish();
        p.fishBag.push(caughtFish);
        addXP(p, 40, interaction.channel, user);

        return interaction.reply({
            content: `🎣 **BẠN CÂU ĐƯỢC CÁ HỜI!**\n🐟 Loài cá: **${caughtFish.name}**\n🌟 Phẩm cấp: **[${caughtFish.rarity}]**\n💰 Giá trị: **${caughtFish.price.toLocaleString()} Xu** (Đã cất vào kho cá \`!khoca\`)`,
            ephemeral: true
        });
    }

    if (interaction.customId === 'act_danhboss') {
        const w = WEAPONS[p.weapon] || WEAPONS[1];
        const dmg = w.damage + (p.level * 50);
        currentBoss.hp -= dmg;
        let msg = `⚔️ Chém Boss **-${dmg.toLocaleString()} HP**! (Còn: ${Math.max(0, currentBoss.hp).toLocaleString()})`;
        if (currentBoss.hp <= 0) {
            p.balance += currentBoss.rewardXu;
            msg = `🎉 **TIÊU DIỆT BOSS!** Nhận +${currentBoss.rewardXu.toLocaleString()} Xu!`;
            bossLevel++; currentBoss = createBoss(bossLevel);
        }
        return interaction.reply({ content: msg, ephemeral: false });
    }

    if (interaction.customId === 'act_khoca') {
        return interaction.reply({ content: `🎒 Kho cá: ${p.fishBag.length} con | Gõ \`!khoca\` trong chat để xem chi tiết danh sách cá!`, ephemeral: true });
    }
});

client.login(process.env.TOKEN);
 
