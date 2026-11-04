const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, settings, user } = require('../db');
const { C, ok, error, info } = require('../utils/embeds');

function rankFor(guildId, count) {
  return db
    .prepare(
      `SELECT * FROM ranks WHERE guild_id=? AND threshold<=?
       ORDER BY threshold DESC LIMIT 1`
    )
    .get(guildId, count);
}

async function applyRank(guild, userId, count) {
  const r = rankFor(guild.id, count);
  if (!r) return null;
  const m = await guild.members.fetch(userId).catch(() => null);
  if (m && !m.roles.cache.has(r.role_id)) await m.roles.add(r.role_id).catch(() => {});
  return r;
}

function card(guild, target, count, author, note) {
  const r = rankFor(guild.id, count);
  const e = new EmbedBuilder()
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
    .setColor(C.info)
    .setTitle('⭐ New Vouch!')
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Vouched User', value: `<@${target.id}>`, inline: true },
      { name: 'Total Vouches', value: `**${count}**`, inline: true },
      { name: 'Rank', value: r?.label ?? 'Unranked', inline: true }
    )
    .setFooter({ text: `Vouched by ${author.username}` })
    .setTimestamp();
  if (note) e.setDescription(`> ${note}`);
  return e;
}

const commands = [
  {
    name: 'vouch',
    aliases: ['rep'],
    slash: true,
    description: 'Vouch for a user',
    options: [
      { name: 'user', type: 6, required: true, description: 'Who to vouch' },
      { name: 'note', type: 3, required: false, description: 'Optional note' },
    ],
    async run(ctx) {
      const target =
        ctx.message?.mentions.users.first() ??
        ctx.interaction?.options.getUser('user');
      if (!target) return ctx.reply({ embeds: [error('Mention a user.')] });
      if (target.bot) return ctx.reply({ embeds: [error('Bots cannot be vouched.')] });
      if (target.id === ctx.user.id) return ctx.reply({ embeds: [error('You cannot vouch yourself.')] });

      const note =
        ctx.message ? ctx.args.slice(1).join(' ') || null : ctx.interaction.options.getString('note');
      const g = ctx.guild.id;

      user(g, target.id);
      db.prepare('UPDATE users SET vouches = vouches + 1 WHERE guild_id=? AND user_id=?').run(
        g,
        target.id
      );
      const { vouches } = db
        .prepare('SELECT vouches FROM users WHERE guild_id=? AND user_id=?')
        .get(g, target.id);

      const rank = await applyRank(ctx.guild, target.id, vouches);
      db.prepare('INSERT INTO vouch_log (guild_id,from_id,to_id,note,at) VALUES (?,?,?,?,?)').run(
        g,
        ctx.user.id,
        target.id,
        note,
        Date.now()
      );

      const s = settings(g);
      const ch = s.vouch_channel
        ? await ctx.guild.channels.fetch(s.vouch_channel).catch(() => null)
        : null;
      const embed = card(ctx.guild, target, vouches, ctx.user, note);
      await (ch ?? ctx.channel).send({ content: `🎉 <@${target.id}> just received +1 vouch!`, embeds: [embed] });

      const ack = rank ? ` +1 → **${vouches}** (${rank.label})` : ` +1 → **${vouches}**`;
      await ctx.reply({ embeds: [ok(`Vouched <@${target.id}>${ack}`)] }).catch(() => {});

      if (s.vouch_dm) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('View Vouches')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/channels/${g}/${(ch ?? ctx.channel).id}`)
        );
        target
          .send({ embeds: [card(ctx.guild, target, vouches, ctx.user, note)], components: [row] })
          .catch(() => {});
      }
    },
  },
  {
    name: 'vouches',
    aliases: ['repcount'],
    slash: true,
    description: 'Check a user vouch count',
    options: [{ name: 'user', type: 6, required: false, description: 'User to check' }],
    async run(ctx) {
      const target =
        ctx.message?.mentions.users.first() ??
        ctx.interaction?.options.getUser('user') ??
        ctx.user;
      const u = user(ctx.guild.id, target.id);
      const r = rankFor(ctx.guild.id, u.vouches);
      const rank = await applyRank(ctx.guild, target.id, u.vouches);
      const pos =
        db
          .prepare(
            `SELECT COUNT(*) c FROM users WHERE guild_id=? AND vouches > ?`
          )
          .get(ctx.guild.id, u.vouches).c + 1;

      const e = new EmbedBuilder()
        .setColor(C.info)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setTitle(`Vouches — ${target.username}`)
        .addFields(
          { name: 'Vouches', value: `**${u.vouches}**`, inline: true },
          { name: 'Rank', value: rank?.label ?? 'Unranked', inline: true },
          { name: 'Position', value: `#${pos}`, inline: true }
        )
        .setFooter({ text: ctx.guild.name });
      await ctx.reply({ embeds: [e] });
    },
  },
  {
    name: 'rank',
    slash: true,
    description: 'Show your rank progress',
    async run(ctx) {
      const u = user(ctx.guild.id, ctx.user.id);
      const next = db
        .prepare('SELECT * FROM ranks WHERE guild_id=? AND threshold>? ORDER BY threshold ASC LIMIT 1')
        .get(ctx.guild.id, u.vouches);
      const cur = rankFor(ctx.guild.id, u.vouches);
      const e = new EmbedBuilder()
        .setColor(C.info)
        .setTitle('Your Rank')
        .addFields(
          { name: 'Current', value: cur?.label ?? 'Unranked', inline: true },
          { name: 'Vouches', value: `**${u.vouches}**`, inline: true },
          { name: 'Next', value: next ? `${next.label} at ${next.threshold}` : 'Maxed', inline: true }
        );
      await ctx.reply({ embeds: [e] });
    },
  },
  {
    name: 'leaderboard',
    aliases: ['top', 'lb'],
    slash: true,
    description: 'Top vouched users',
    async run(ctx) {
      const rows = db
        .prepare('SELECT user_id, vouches FROM users WHERE guild_id=? ORDER BY vouches DESC LIMIT 10')
        .all(ctx.guild.id);
      if (!rows.length) return ctx.reply({ embeds: [info('No vouches yet.')] });
      const lines = rows.map((r, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`;
        return `${medal} <@${r.user_id}> — **${r.vouches}** vouches`;
      });
      const e = new EmbedBuilder()
        .setColor(C.gold)
        .setTitle(`🏆 Vouch Leaderboard — ${ctx.guild.name}`)
        .setDescription(lines.join('\n'))
        .setTimestamp();
      await ctx.reply({ embeds: [e] });
    },
  },
  {
    name: 'setvouch',
    admin: true,
    description: 'Set a user vouch count',
    options: [
      { name: 'user', type: 6, required: true, description: 'Target' },
      { name: 'count', type: 4, required: true, description: 'New count' },
    ],
    async run(ctx) {
      const target =
        ctx.message?.mentions.users.first() ?? ctx.interaction.options.getUser('user');
      const n = parseInt(ctx.message ? ctx.args[1] : ctx.interaction.options.getInteger('count'));
      if (!target || isNaN(n)) return ctx.reply({ embeds: [error('Usage: setvouch @user <count>')] });

      user(ctx.guild.id, target.id);
      db.prepare('UPDATE users SET vouches=? WHERE guild_id=? AND user_id=?').run(n, ctx.guild.id, target.id);
      const r = await applyRank(ctx.guild, target.id, n);
      await ctx.reply({
        embeds: [ok(`<@${target.id}> set to **${n}** vouches → ${r?.label ?? 'Unranked'}`)],
      });
    },
  },
  {
    name: 'addvouch',
    admin: true,
    description: 'Add vouches in bulk',
    async run(ctx) {
      const target = ctx.message?.mentions.users.first();
      const n = parseInt(ctx.args[1]) || 1;
      if (!target) return ctx.reply({ embeds: [error('Usage: addvouch @user <count>')] });
      user(ctx.guild.id, target.id);
      db.prepare('UPDATE users SET vouches = vouches + ? WHERE guild_id=? AND user_id=?').run(
        n,
        ctx.guild.id,
        target.id
      );
      const { vouches } = db
        .prepare('SELECT vouches FROM users WHERE guild_id=? AND user_id=?')
        .get(ctx.guild.id, target.id);
      await applyRank(ctx.guild, target.id, vouches);
      await ctx.reply({ embeds: [ok(`<@${target.id}> now at **${vouches}** vouches.`)] });
    },
  },
  {
    name: 'clearvouches',
    aliases: ['resetvouch'],
    admin: true,
    async run(ctx) {
      const target = ctx.message?.mentions.users.first();
      if (!target) return ctx.reply({ embeds: [error('Mention a user.')] });
      user(ctx.guild.id, target.id);
      db.prepare('UPDATE users SET vouches=0 WHERE guild_id=? AND user_id=?').run(
        ctx.guild.id,
        target.id
      );
      await ctx.reply({ embeds: [ok(`Cleared vouches for <@${target.id}>.`)] });
    },
  },
  {
    name: 'rankrole',
    admin: true,
    async run(ctx) {
      const threshold = parseInt(ctx.args[0]);
      const role = ctx.message?.mentions.roles.first();
      const label = ctx.args.slice(2).join(' ') || `Rank ${threshold}`;
      if (isNaN(threshold) || !role)
        return ctx.reply({ embeds: [error('Usage: rankrole <threshold> @role <label>')] });
      db.prepare(
        `INSERT INTO ranks (guild_id,threshold,role_id,label) VALUES (?,?,?,?)
         ON CONFLICT(guild_id,threshold) DO UPDATE SET role_id=excluded.role_id, label=excluded.label`
      ).run(ctx.guild.id, threshold, role.id, label);
      await ctx.reply({ embeds: [ok(`**${threshold}** → ${role} (${label})`)] });
    },
  },
  {
    name: 'rankroles',
    admin: true,
    async run(ctx) {
      const rows = db
        .prepare('SELECT * FROM ranks WHERE guild_id=? ORDER BY threshold ASC')
        .all(ctx.guild.id);
      if (!rows.length) return ctx.reply({ embeds: [info('No ranks set.')] });
      const e = new EmbedBuilder()
        .setColor(C.info)
        .setTitle('Rank Ladder')
        .setDescription(rows.map((r) => `**${r.threshold}** → <@&${r.role_id}> (${r.label})`).join('\n'));
      await ctx.reply({ embeds: [e] });
    },
  },
  {
    name: 'delrank',
    admin: true,
    async run(ctx) {
      const t = parseInt(ctx.args[0]);
      if (isNaN(t)) return ctx.reply({ embeds: [error('Usage: delrank <threshold>')] });
      db.prepare('DELETE FROM ranks WHERE guild_id=? AND threshold=?').run(ctx.guild.id, t);
      await ctx.reply({ embeds: [ok(`Removed rank at ${t}.`)] });
    },
  },
  {
    name: 'vouchchannel',
    admin: true,
    async run(ctx) {
      const ch = ctx.message?.mentions.channels.first();
      if (!ch) return ctx.reply({ embeds: [error('Mention a channel.')] });
      settings(ctx.guild.id);
      db.prepare('UPDATE settings SET vouch_channel=? WHERE guild_id=?').run(ch.id, ctx.guild.id);
      await ctx.reply({ embeds: [ok(`Vouch channel set to ${ch}.`)] });
    },
  },
  {
    name: 'vouchdm',
    admin: true,
    async run(ctx) {
      const s = settings(ctx.guild.id);
      const next = s.vouch_dm ? 0 : 1;
      db.prepare('UPDATE settings SET vouch_dm=? WHERE guild_id=?').run(next, ctx.guild.id);
      await ctx.reply({ embeds: [ok(`Vouch DMs: **${next ? 'on' : 'off'}**`)] });
    },
  },
  {
    name: 'immune',
    admin: true,
    async run(ctx) {
      const target = ctx.message?.mentions.users.first();
      if (!target) return ctx.reply({ embeds: [error('Mention a user.')] });
      user(ctx.guild.id, target.id);
      db.prepare('UPDATE users SET is_immune=1 WHERE guild_id=? AND user_id=?').run(
        ctx.guild.id,
        target.id
      );
      await ctx.reply({ embeds: [ok(`<@${target.id}> is now immune.`)] });
    },
  },
  {
    name: 'unimmune',
    admin: true,
    async run(ctx) {
      const target = ctx.message?.mentions.users.first();
      if (!target) return ctx.reply({ embeds: [error('Mention a user.')] });
      db.prepare('UPDATE users SET is_immune=0 WHERE guild_id=? AND user_id=?').run(
        ctx.guild.id,
        target.id
      );
      await ctx.reply({ embeds: [ok(`<@${target.id}> is no longer immune.`)] });
    },
  },
];

module.exports = commands;
