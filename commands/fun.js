const { EmbedBuilder } = require('discord.js');
const { db } = require('../db');
const { C, ok, error, info } = require('../utils/embeds');
const snipe = require('../utils/snipe');

const commands = [
  {
    name: 'giveaway',
    aliases: ['gstart'],
    admin: true,
    async run(ctx) {
      const ch = ctx.message?.mentions.channels.first();
      const rest = ctx.args.slice(1);
      if (!ch || rest.length < 2)
        return ctx.reply({ embeds: [error('Usage: giveaway #channel 10m 1 prize')] });

      const m = rest[0].match(/^(\d+)([smhd])$/i);
      if (!m) return ctx.reply({ embeds: [error('Bad duration. Use 10s/10m/10h/10d.')] });
      const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2].toLowerCase()];
      const ms = parseInt(m[1]) * mult;
      const winners = parseInt(rest[1]) || 1;
      const prize = rest.slice(2).join(' ') || 'Prize';

      const embed = new EmbedBuilder()
        .setColor(C.gold)
        .setTitle('🎉 GIVEAWAY')
        .setDescription(
          `Prize: **${prize}**\nWinners: **${winners}**\nEnds: <t:${Math.floor(
            (Date.now() + ms) / 1000
          )}:R>\n\nReact with 🎉 to enter.`
        )
        .setFooter({ text: `Hosted by ${ctx.user.username}` });

      const msg = await ch.send({ embeds: [embed] });
      await msg.react('🎉');

      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO giveaways (guild_id,channel_id,message_id,prize,winners,host_id,ends_at)
           VALUES (?,?,?,?,?,?,?)`
        )
        .run(ctx.guild.id, ch.id, msg.id, prize, winners, ctx.user.id, Date.now() + ms);

      await ctx.reply({ embeds: [ok(`Giveaway started in ${ch}.`)] });
      setTimeout(() => end(ctx.client, lastInsertRowid), ms);
    },
  },
  {
    name: 'gend',
    admin: true,
    async run(ctx) {
      const id = parseInt(ctx.args[0]);
      if (isNaN(id)) return ctx.reply({ embeds: [error('Usage: gend <id>')] });
      await end(ctx.client, id);
      await ctx.reply({ embeds: [ok(`Ended giveaway #${id}.`)] });
    },
  },
  {
    name: 'reroll',
    admin: true,
    async run(ctx) {
      const id = parseInt(ctx.args[0]);
      const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(id);
      if (!g) return ctx.reply({ embeds: [error('Not found.')] });
      const ch = await ctx.guild.channels.fetch(g.channel_id).catch(() => null);
      const msg = await ch?.messages.fetch(g.message_id).catch(() => null);
      const users = msg ? [...(await msg.reactions.cache.get('🎉')?.users.fetch()).keys()] : [];
      const pool = users.filter((u) => !u.bot);
      if (!pool.length) return ctx.reply({ embeds: [error('No entries.')] });
      const pick = pool[Math.floor(Math.random() * pool.length)];
      await ch.send(`🎉 Reroll winner: <@${pick}> — **${g.prize}**`);
      await ctx.reply({ embeds: [ok('Rerolled.')] });
    },
  },
  {
    name: 'poll',
    admin: true,
    async run(ctx) {
      const text = ctx.args.join(' ');
      if (!text) return ctx.reply({ embeds: [error('Usage: poll <question>')] });
      const msg = await ctx.send({
        embeds: [new EmbedBuilder().setColor(C.info).setTitle('📊 ' + text)],
      });
      await msg.react('👍');
      await msg.react('👎');
      await msg.react('🤷');
    },
  },
  {
    name: 'snipe',
    async run(ctx) {
      const s = snipe.get(ctx.channel.id);
      if (!s) return ctx.reply({ embeds: [info('Nothing to snipe.')] });
      const e = new EmbedBuilder()
        .setColor(C.dark)
        .setAuthor({ name: s.author, iconURL: s.avatar ?? undefined })
        .setDescription(s.content || '*no text*')
        .setTimestamp(s.at);
      if (s.image) e.setImage(s.image);
      await ctx.reply({ embeds: [e] });
    },
  },
  {
    name: 'ping',
    async run(ctx) {
      await ctx.reply({ embeds: [info(`🏓 ${ctx.client.ws.ping}ms`)] });
    },
  },
  {
    name: 'uptime',
    async run(ctx) {
      const s = Math.floor(process.uptime());
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      await ctx.reply({ embeds: [info(`⏱️ Up ${h}h ${m}m`)] });
    },
  },
  {
    name: 'help',
    async run(ctx) {
      const all = require('../index').commands;
      const pub = [];
      const adm = [];
      for (const c of new Set(all.values())) {
        (c.admin ? adm : pub).push(`\`${c.name}\``);
      }
      const e = new EmbedBuilder()
        .setColor(C.dark)
        .setTitle('Commands')
        .addFields(
          { name: 'Public', value: pub.join(' ') || 'none' },
          { name: 'Staff', value: adm.join(' ') || 'none' }
        );
      await ctx.reply({ embeds: [e] });
    },
  },
];

async function end(client, id) {
  const g = db.prepare('SELECT * FROM giveaways WHERE id=? AND ended=0').get(id);
  if (!g) return;
  db.prepare('UPDATE giveaways SET ended=1 WHERE id=?').run(id);

  const ch = await client.channels.fetch(g.channel_id).catch(() => null);
  if (!ch) return;
  const msg = await ch.messages.fetch(g.message_id).catch(() => null);
  if (!msg) return;

  const users = [...(await msg.reactions.cache.get('🎉')?.users.fetch()).keys()];
  const pool = users.filter((u) => !u.bot);

  if (!pool.length) {
    return ch.send(`🎉 No entries — no winner for **${g.prize}**.`);
  }

  const picked = [];
  while (picked.length < g.winners && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  await ch.send(
    `🎉 Winners: ${picked.map((p) => `<@${p}>`).join(', ')} — you won **${g.prize}**!`
  );
}

module.exports = commands;
