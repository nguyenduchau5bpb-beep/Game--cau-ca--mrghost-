const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// KEEP ALIVE FOR RENDER / REPLIT
const app = express();
app.get('/', (req, res) => res.send('🚀 Fishing & Boss Bot IS ALIVE!'));
app.listen(process.env.PORT || 3000);

const PREFIX = '!';
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// CƠ SỞ DỮ LIỆU IN-MEMORY
const userData = {};

function getUser(id) {
    if (!userData[id]) {
        userData[id] = {
            balance: 2000,
            shells: 0,          // Sò 🦪
            xp: 0,
            level: 1,
            totalCaught: 0,
            rod: 1,             // Cần câu (1-40)
            lake: 1,            // Hồ câu (1-10)
            weapon: 1,          // Vũ khí đánh Boss (1-20)
            isFishing: false,
            fishStartTime: 0,
            inventoryFresh: {}, // Cá tươi
            inventoryCooked: {} // Cá đã chế biến
        };
    }
    return userData[id];
}

// 1. DỮ LIỆU 40 LOẠI CẦN CÂU (CẦN 30->40 TỐN XU + SÒ 🦪)
const RODS = {};
for (let i = 1; i <= 40; i++) {
    RODS[i] = {
        id: i,
        name: `Cần Cấp ${i} 🎣`,
        priceXu: i * 2000,
        priceShell: i >= 30 ? (i - 29) * 500 : 0,
        luck: i * 3,
        reqLevel: Math.ceil(i / 2)
    };
}

// 2. DỮ LIỆU HỒ CÂU (MUA BẰNG XU - HỒ CAO CÁ XỊN & NHIỀU XP)
const LAKES = {
    1: { name: 'Hồ Đồng Cỏ 🌊', price: 0, xpBonus: 1, reqLevel: 1 },
    2: { name: 'Sông Rồng Xanh 🐉', price: 10000, xpBonus: 1.5, reqLevel: 5 },
    3: { name: 'Biển Sâu Băng Giá ❄️', price: 50000, xpBonus: 2.2, reqLevel: 10 },
    4: { name: 'Vực Thẫm Thủy Quái 🦑', price: 200000, xpBonus: 3.5, reqLevel: 20 },
    5: { name: 'Hồ Thần Thoại Ancient 🏛️', price: 1000000, xpBonus: 5.0, reqLevel: 30 }
};

// 3. DỮ LIỆU VŨ KHÍ ĐÁNH BOSS (1 - 20)
const WEAPONS = {};
for (let i = 1; i <= 20; i++) {
    WEAPONS[i] = {
        id: i,
        name: `Vũ Khí Cấp ${i} ⚔️`,
        priceXu: i * 5000,
        priceShell: i * 50,
        damage: i * 300
    };
}

// 4. HỆ THỐNG BOSS THẾ GIỚI (CẤP CAO CÀNG TRÂU)
const BOSS_TEMPLATE = [
    { level: 1, name: 'Hải Tặc Bán Cá 🏴‍☠️', maxHp: 5000, rewardXu: 10000, rewardShell: 200 },
    { level: 2, name: 'Bạch Tuộc Quỷ 🐙', maxHp: 25000, rewardXu: 50000, rewardShell: 1000 },
    { level: 3, name: 'Cá Mập Cổ Đại Megalodon 🦈', maxHp: 100000, rewardXu: 250000, rewardShell: 3000 },
    { level: 4, name: 'Rồng Biển Khổng Lồ 🐉', maxHp: 500000, rewardXu: 1000000, rewardShell: 10000 }
];

let currentBossIndex = 0;
let currentBoss = { ...BOSS_TEMPLATE[0], hp: BOSS_TEMPLATE[0].maxHp };

// DANH SÁCH CÁ
const FISH_TYPES = [
    { name: 'Cá Rác 👞', price: 20, xp: 10, chance: 30, emoji: '👞' },
    { name: 'Cá Cơm 🐟', price: 50, xp: 20, chance: 25, emoji: '🐟' },
    { name: 'Cá Rô 🐠', price: 120, xp: 40, chance: 15, emoji: '🐠' },
    { name: 'Cá Lóc 🐟', price: 300, xp: 80, chance: 10, emoji: '🐟' },
    { name: 'Cá Tắm 🐡', price: 700, xp: 150, chance: 8, emoji: '🐡' },
    { name: 'Cá Mập 🦈', price: 2000, xp: 400, chance: 5, emoji: '🦈' },
    { name: 'Cá Rồng Hoàng Gia 🐉', price: 10000, xp: 1500, chance: 1.5, emoji: '🐉' },
    { name: 'Thủy Quái Leviathan 🐲', price: 60000, xp: 6000, chance: 0.5, emoji: '🐲' }
];

// CẤP ĐỘ XP
function addXP(p, amount, channel, user) {
    p.xp += Math.floor(amount);
    const nextLevelXP = p.level * 300;
    if (p.xp >= nextLevelXP) {
        p.level++;
        p.xp -= nextLevelXP;
        channel.send(`🎊 Chúc mừng **${user.username}** đã thăng lên **Level ${p.level}**! Mở khóa nhiều trang bị mới trong \`!shop\`!`);
    }
}

client.on('ready', () => {
    console.log(`✅ Bot Online với Prefix '!': ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const user = message.author;
    const p = getUser(user.id);
    const now = Date.now();

    // 1. MENU HƯỚNG DẪN
    if (command === 'menu' || command === '') {
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🎣 BẢNG HƯỚNG DẪN GAME CÂU CÁ & SĂN BOSS 👾')
            .setDescription(
                `**CÂU CÁ TREO MÁY:**\n` +
                `• \`!start\`: Thả cần treo máy (có thể thoát Discord đi ngủ).\n` +
                `• \`!stop\`: Giật cần thu hoạch cá sau khi treo máy.\n` +
                `• \`!khoca\`: Xem kho cá, Xu, Sò & trang bị.\n` +
                `• \`!banca\`: Bán tất cả cá tươi.\n` +
                `• \`!chebien\`: Nướng/Chế biến toàn bộ cá tươi để **tăng +60% giá trị**!\n` +
                `• \`!banchebien\`: Bán cá đã chế biến lấy Xu khủng.\n\n` +
                `**SĂN BOSS & SÒ 🦪:**\n` +
                `• \`!boss\`: Xem Boss Server hiện tại.\n` +
                `• \`!danhboss\`: Đánh Boss bằng Vũ khí để cày Sò 🦪.\n` +
                `• \`!shopboss\`: Xem Shop Vũ Khí.\n` +
                `• \`!muavukhi <id>\`: Mua Vũ Khí đánh Boss (1-20).\n\n` +
                `**CỬA HÀNG & HỒ CÂU:**\n` +
                `• \`!shoprod\`: Xem Shop Cần Câu (Cần 30-40 tốn Xu + Sò).\n` +
                `• \`!muarod <id>\`: Mua Cần Câu (1-40).\n` +
                `• \`!shoplake\`: Xem danh sách Hồ Câu.\n` +
                `• \`!mualake <id>\`: Mua & Đổi Hồ Câu nâng cấp XP/Cá.\n\n` +
                `**KHÁC:**\n` +
                `• \`!daily\`: Điểm danh nhận Xu + Sò.\n` +
                `• \`!top <daigia/vuaso/satngu/capdo>\`: Xem Bảng Xếp Hạng.`
            );
        return message.channel.send({ embeds: [embed] });
    }

    // 2. THẢ CẦU TREO MÁY (!start)
    if (command === 'start') {
        if (p.isFishing) return message.reply('⚠️ Bạn đã thả cần từ trước rồi! Gõ `!stop` để giật cần!');

        p.isFishing = true;
        p.fishStartTime = now;
        const currentLake = LAKES[p.lake];

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🌊 ĐÃ THẢ CẦN TREO MÁY!')
            .setDescription(`**${user.username}** vừa thả câu tại **${currentLake.name}**!\n\n💤 *Bạn có thể tắt Discord đi ngủ!* Khi nào quay lại gõ \`!stop\` để giật cần!`);
        return message.channel.send({ embeds: [embed] });
    }

    // 3. GIẬT CẦN (!stop)
    if (command === 'stop') {
        if (!p.isFishing) return message.reply('❌ Bạn chưa thả cần! Gõ `!start` trước.');

        const minutesTreo = Math.max(1, Math.floor((now - p.fishStartTime) / (1000 * 60))); // Mỗi phút = 1 con
        const catchAmount = Math.min(30, minutesTreo); // Tối đa 30 con
        p.isFishing = false;

        const currentRod = RODS[p.rod];
        const currentLake = LAKES[p.lake];
        let summaryText = '';

        for (let i = 0; i < catchAmount; i++) {
            const rand = Math.random() * 100;
            let cumulative = 0;
            let caught = FISH_TYPES[0];

            for (const f of FISH_TYPES) {
                cumulative += f.chance + (currentRod.luck * 0.1);
                if (rand <= cumulative) { caught = f; break; }
            }

            p.inventoryFresh[caught.name] = (p.inventoryFresh[caught.name] || 0) + 1;
            p.totalCaught++;
            addXP(p, caught.xp * currentLake.xpBonus, message.channel, user);
            summaryText += `${caught.emoji}${caught.name}\n`;
        }

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🎣 THU HOẠCH SAU KHI TREO MÁY!')
            .setDescription(`Chúc mừng **${user.username}**, bạn giật được **${catchAmount}** con cá tại **${currentLake.name}**:\n\n${summaryText.slice(0, 1000)}`);
        return message.channel.send({ embeds: [embed] });
    }

    // 4. CHẾ BIẾN CÁ (+60% TIỀN)
    if (command === 'chebien') {
        let count = 0;
        FISH_TYPES.forEach(f => {
            const amount = p.inventoryFresh[f.name] || 0;
            if (amount > 0) {
                count += amount;
                p.inventoryCooked[f.name] = (p.inventoryCooked[f.name] || 0) + amount;
                p.inventoryFresh[f.name] = 0;
            }
        });

        if (count === 0) return message.reply('❌ Bạn không có cá tươi nào trong kho để chế biến!');
        return message.reply(`🍳 **${user.username}** đã chế biến thành công **${count}** con cá! Cá chế biến bán sẽ được **+60% TIỀN XU** (Gõ \`!banchebien\` để bán)!`);
    }

    // 5. BÁN CÁ
    if (command === 'banca') {
        let total = 0, count = 0;
        FISH_TYPES.forEach(f => {
            const amt = p.inventoryFresh[f.name] || 0;
            if (amt > 0) { total += amt * f.price; count += amt; p.inventoryFresh[f.name] = 0; }
        });
        if (count === 0) return message.reply('❌ Không có cá tươi để bán!');
        p.balance += total;
        return message.reply(`💰 Bạn đã bán **${count}** con cá tươi nhận về **${total} 🪙 Xu**!`);
    }

    if (command === 'banchebien') {
        let total = 0, count = 0;
        FISH_TYPES.forEach(f => {
            const amt = p.inventoryCooked[f.name] || 0;
            if (amt > 0) { 
                total += amt * Math.floor(f.price * 1.6); // +60% Tiền
                count += amt; 
                p.inventoryCooked[f.name] = 0; 
            }
        });
        if (count === 0) return message.reply('❌ Không có cá chế biến để bán!');
        p.balance += total;
        return message.reply(`🔥 **${user.username}** đã bán **${count}** con cá chế biến chất lượng cao và thu về **${total} 🪙 Xu** (+60%)!`);
    }

    // 6. XEM BOSS & ĐÁNH BOSS
    if (command === 'boss') {
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle(`👾 BOSS SERVER CẤP ${currentBoss.level}:${currentBoss.name}`)
            .setDescription(
                `❤️ **HP Boss:** \`${currentBoss.hp} / ${currentBoss.maxHp}\`\n` +
                `🪙 **Thưởng Xu:** \`${currentBoss.rewardXu}\` Xu\n` +
                `🦪 **Thưởng Sò:** \`${currentBoss.rewardShell}\` Sò\n\n` +
                `👉 Gõ \`!danhboss\` để tấn công bằng Vũ khí!`
            );
        return message.channel.send({ embeds: [embed] });
    }

    if (command === 'danhboss') {
        if (currentBoss.hp <= 0) return message.reply('👾 Boss đã chết! Đang chờ hồi sinh...');

        const weapon = WEAPONS[p.weapon] || WEAPONS[1];
        const dmg = weapon.damage + (p.level * 20);
        currentBoss.hp -= dmg;

        let msg = `⚔️ **${user.username}** dùng **${weapon.name}** chém Boss gây **-${dmg} SMC**!\n❤️ HP Boss còn: \`${Math.max(0, currentBoss.hp)} / ${currentBoss.maxHp}\``;

        if (currentBoss.hp <= 0) {
            p.balance += currentBoss.rewardXu;
            p.shells += currentBoss.rewardShell;
            msg += `\n\n🎉 **BẠN ĐÃ TIÊU DIỆT BOSS CẤP ${currentBoss.level}!**\nNhận ngay: **+${currentBoss.rewardXu} 🪙 Xu** & **+${currentBoss.rewardShell} 🦪 Sò**!`;

            // Tăng cấp Boss tiếp theo
            currentBossIndex = (currentBossIndex + 1) % BOSS_TEMPLATE.length;
            const nextB = BOSS_TEMPLATE[currentBossIndex];
            currentBoss = { ...nextB, hp: nextB.maxHp };
            msg += `\n\n🔥 **BOSS MỚI XUẤT HIỆN:** ${currentBoss.name} (HP: ${currentBoss.maxHp})!`;
        }

        return message.channel.send(msg);
    }

    // 7. SHOP CẦN CÂU (1-40)
    if (command === 'shoprod') {
        let text = '🎣 **CỬA HÀNG CẦN CÂU (1 - 40)**\n*(Cần 30 - 40 yêu cầu Xu + Sò 🦪)*\n\n';
        for (let i = 28; i <= 35; i++) {
            text += `• **ID ${i}**: ${RODS[i].name} - Giá: \`${RODS[i].priceXu} Xu\` + \`${RODS[i].priceShell} 🦪 Sò\`\n`;
        }
        text += '*...Dùng `!muarod <id>` để mua bất kỳ Cần nào từ 1 đến 40!*';
        return message.channel.send({ embeds: [new EmbedBuilder().setColor('#f1c40f').setTitle('🛒 SHOP CẦN CÂU').setDescription(text)] });
    }

    if (command === 'muarod') {
        const id = parseInt(args[0]);
        const rod = RODS[id];
        if (!rod) return message.reply('❌ ID Cần không hợp lệ (1 - 40)!');

        if (p.level < rod.reqLevel) return message.reply(`❌ Yêu cầu Level ${rod.reqLevel} để mua!`);
        if (p.balance < rod.priceXu || p.shells < rod.priceShell) {
            return message.reply(`❌ Thiếu tiền! Giá: **${rod.priceXu} Xu** + **${rod.priceShell} 🦪 Sò**.`);
        }

        p.balance -= rod.priceXu;
        p.shells -= rod.priceShell;
        p.rod = id;
        return message.reply(`🎉 **${user.username}** đã sở hữu thành công **${rod.name}**!`);
    }

    // 8. SHOP HỒ CÂU
    if (command === 'shoplake') {
        let text = '🌊 **DANH SÁCH HỒ CÂU NÂNG CẤP**\n\n';
        Object.keys(LAKES).forEach(id => {
            const l = LAKES[id];
            text += `• **ID ${id}**: ${l.name} - Giá: \`${l.price} Xu\` (XP x${l.xpBonus}) - Req Lv: ${l.reqLevel}\n`;
        });
        return message.channel.send({ embeds: [new EmbedBuilder().setColor('#3498db').setTitle('🏕️ CỬA HÀNG HỒ CÂU').setDescription(text)] });
    }

    if (command === 'mualake') {
        const id = parseInt(args[0]);
        const lake = LAKES[id];
        if (!lake) return message.reply('❌ ID Hồ không hợp lệ!');

        if (p.level < lake.reqLevel) return message.reply(`❌ Bạn chưa đủ Level ${lake.reqLevel}!`);
        if (p.balance < lake.price) return message.reply('❌ Bạn không đủ Xu để mua Hồ này!');

        p.balance -= lake.price;
        p.lake = id;
        return message.reply(`🎉 **${user.username}** đã chuyển sang hồ câu **${lake.name}**! Tất cả cá câu được sẽ x${lake.xpBonus} XP!`);
    }

    // 9. SHOP VŨ KHÍ
    if (command === 'shopboss') {
        let text = '⚔️ **DANH SÁCH VŨ KHÍ ĐÁNH BOSS (1 - 20)**\n\n';
        for (let i = 1; i <= 8; i++) {
            text += `• **ID ${i}**: ${WEAPONS[i].name} (SMC: ${WEAPONS[i].damage}) - Giá: \`${WEAPONS[i].priceXu} Xu\` + \`${WEAPONS[i].priceShell} 🦪 Sò\`\n`;
        }
        text += '*...Dùng `!muavukhi <id>` để mua!*';
        return message.channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle('🛒 SHOP VŨ KHÍ').setDescription(text)] });
    }

    if (command === 'muavukhi') {
        const id = parseInt(args[0]);
        const w = WEAPONS[id];
        if (!w) return message.reply('❌ ID Vũ khí không đúng (1 - 20)!');

        if (p.balance < w.priceXu || p.shells < w.priceShell) {
            return message.reply('❌ Bạn không đủ Xu hoặc Sò 🦪!');
        }

        p.balance -= w.priceXu;
        p.shells -= w.priceShell;
        p.weapon = id;
        return message.reply(`🎉 **${user.username}** đã trang bị **${w.name}** (SMC: +${w.damage})!`);
    }

    // 10. KHO ĐỒ (!khoca)
    if (command === 'khoca') {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`🎒 KHO ĐỒ & TRANG BỊ - ${user.username}`)
            .setDescription(
                `🪙 **Tiền Xu:** \`${p.balance}\` Xu\n` +
                `🦪 **Tiền Sò:** \`${p.shells}\` Sò\n` +
                `⭐ **Cấp độ:** Level \`${p.level}\` (${p.xp} XP)\n` +
                `🎣 **Cần đang dùng:** ${RODS[p.rod].name}\n` +
                `🌊 **Hồ đang câu:** ${LAKES[p.lake].name}\n` +
                `⚔️ **Vũ khí đang dùng:** ${WEAPONS[p.weapon].name}\n` +
                `🦈 **Tổng cá đã câu:** \`${p.totalCaught}\` con`
            );
        return message.channel.send({ embeds: [embed] });
    }

    // 11. ĐIỂM DANH (!daily)
    if (command === 'daily') {
        const cooldown = 24 * 60 * 60 * 1000;
        if (now - (p.lastDaily || 0) < cooldown) return message.reply('⏳ Bạn đã điểm danh hôm nay rồi!');
        p.balance += 5000;
        p.shells += 100;
        p.lastDaily = now;
        return message.reply(`🎉 Điểm danh thành công! Nhận **5,000 🪙 Xu** & **100 🦪 Sò**!`);
    }

    // 12. BẢNG XẾP HẠNG (!top)
    if (command === 'top') {
        const type = args[0] || 'daigia';
        let sorted = [];
        if (type === 'daigia') sorted = Object.keys(userData).map(id => ({ id, val: userData[id].balance })).sort((a, b) => b.val - a.val);
        if (type === 'vuaso') sorted = Object.keys(userData).map(id => ({ id, val: userData[id].shells })).sort((a, b) => b.val - a.val);
        if (type === 'satngu') sorted = Object.keys(userData).map(id => ({ id, val: userData[id].totalCaught })).sort((a, b) => b.val - a.val);
        if (type === 'capdo') sorted = Object.keys(userData).map(id => ({ id, val: userData[id].level })).sort((a, b) => b.val - a.val);

        let topText = '';
        sorted = sorted.slice(0, 10);
        for (let i = 0; i < sorted.length; i++) {
            const u = await client.users.fetch(sorted[i].id).catch(() => null);
            topText += `**#${i + 1}** ${u ? u.username : sorted[i].id}: \`${sorted[i].val}\`\n`;
        }

        return message.channel.send({ embeds: [new EmbedBuilder().setColor('#9b59b6').setTitle(`🏆 BẢNG XẾP HẠNG TOP ${type.toUpperCase()}`).setDescription(topText || 'Trống.')] });
    }

    // 13. LỆNH ADMIN (RESET BOSS, CỘNG TIỀN)
    if (command === 'resetboss') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Chỉ Admin mới dùng được lệnh này!');
        currentBoss = { ...BOSS_TEMPLATE[0], hp: BOSS_TEMPLATE[0].maxHp };
        currentBossIndex = 0;
        return message.reply('✅ Admin đã reset Boss Thế Giới về Boss Cấp 1!');
    }

    if (command === 'congxu') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]);
        if (target && amt) { getUser(target.id).balance += amt; message.reply(`✅ Đã cộng **+${amt} Xu** cho ${target.username}!`); }
    }

    if (command === 'congso') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const target = message.mentions.users.first();
        const amt = parseInt(args[1]);
        if (target && amt) { getUser(target.id).shells += amt; message.reply(`✅ Đã cộng **+${amt} 🦪 Sò** cho ${target.username}!`); }
    }
});

client.login(process.env.TOKEN);
