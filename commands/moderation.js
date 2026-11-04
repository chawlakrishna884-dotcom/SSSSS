const { EmbedBuilder } = require('discord.js');
const { db } = require('../db');
const { C, ok, error, info } = require('../utils/embeds');

async function target(ctx) {
  const u =
    ctx.message?.mentions.users.first() ??
    (ctx.args[0] ? await ctx.guild.members.fetch(ctx.args[0]).catch(() => null) : null);
  return u ?? null;
}

const commands = [
  {
    name: 'ban',
    admin: true,
    async run(ctx) {
      const u = await target(ctx);
      if (!u) return ctx.reply({ embeds: [error('Mention a user.')] });
      const reason = ctx.args.slice(1).join(' ') || 'No reason';
      const m = await ctx.guild.members.fetch(u.id).catch(() => null);
      await ctx.guild.bans.create(u.id, { reason }).catch((e) => ctx.reply({ embeds: [error(e.message)] }));
      if (m) await m.kick(reason).catch(() => {});
      await ctx.reply({ embeds: [ok(`🔨 Banned **${u.tag}** — ${reason}`)] });
    },
  },
  {
    name: 'unban',
    admin: true,
    async run(ctx) {
      const id = ctx.args[0];
      if (!id) return ctx.reply({ embeds: [error('Usage: unban <id>')] });
      await ctx.guild.bans.remove(id).catch((e) => ctx.reply({ embeds: [error(e.message)] }));
      await ctx.reply({ embeds: [ok(`Unbanned \`${id}\`.`)] });
    },
  },
  {
    name: 'kick',
    admin: true,
    async run(ctx) {
      const u = await target(ctx);
      if (!u) return ctx.reply({ embeds: [error('Mention a user.')] });
      const reason = ctx.args.slice(1).join(' ') || 'No reason';
      const m = await ctx.guild.members.fetch(u.id).catch(() => null);
      if (!m) return ctx.reply({ embeds: [error('Not in server.')] });
      await m.kick(reason);
      await ctx.reply({ embeds: [ok(`👢 Kicked **${u.tag}** — ${reason}`)] });
    },
  },
  {
    name: 'mute',
    aliases: ['timeout'],
    admin: true,
    async run(ctx) {
      const u = await target(ctx);
      if (!u) return ctx.reply({ embeds: [error('Mention a user.')] });
      const mins = parseInt(ctx.args[1]) || 10;
      const m = await ctx.guild.members.fetch(u.id).catch(() => null);
      if (!m) return ctx.reply({ embeds: [error('Not in server.')] });
      await m.timeout(mins * 60000, ctx.args.slice(2).join(' ') || 'Muted');
      await ctx.reply({ embeds: [ok(`🔇 Muted **${u.tag}** for ${mins}m.`)] });
    },
  },
  {
    name: 'unmute',
    admin: true,
    async run(ctx) {
      const u = await target(ctx);
      if (!u) return ctx.reply({ embeds: [error('Mention a user.')] });
      const m = await ctx.guild.members.fetch(u.id).catch(() => null);
      if (!m) return ctx.reply({ embeds: [error('Not in server.')] });
      await m.timeout(null);
      await ctx.reply({ embeds: [ok(`🔊 Unmuted **${u.tag}**.`)] });
    },
  },
  {
    name: 'warn',
    admin: true,
    async run(ctx) {
      const u = await target(ctx);
      if (!u) return ctx.reply({ embeds: [error('Mention a user.')] });
      const reason = ctx.args.slice(1).join(' ') || 'No reason';
      db.prepare('INSERT INTO warns (guild_id,user_id,mod_id,reason,at) VALUES (?,?,?,?,?)').run(
        ctx.guild.id,
        u.id,
        ctx.user.id,
        reason,
        Date.now()
      );
      const count = db
        .prepare('SELECT COUNT(*) c FROM warns WHERE guild_id=? AND user_id=?')
        .get(ctx.guild.id, u.id).c;
      await ctx.reply({ embeds: [ok(`⚠️ Warned **${u.tag}** (${count} total) — ${reason}`)] });
    },
  },
  {
    name: 'warnings',
    aliases: ['warns'],
    async run(ctx) {
      const u = ctx.message?.mentions.users.first() ?? ctx.user;
      const rows = db
        .prepare('SELECT * FROM warns WHERE guild_id=? AND user_id=? ORDER BY id DESC')
        .all(ctx.guild.id, u.id);
      if (!rows.length) return ctx.reply({ embeds: [info(`**${u.tag}** has no warnings.`)] });
      const e = new EmbedBuilder()
        .setColor(C.err)
        .setTitle(`Warnings — ${u.tag}`)
        .setDescription(
          rows
            .slice(0, 15)
            .map((r) => `**#${r.id}** by <@${r.mod_id}> — ${r.reason}`)
            .join('\n')
        );
      await ctx.reply({ embeds: [e] });
    },
  },
  {
    name: 'delwarn',
    admin: true,
    async run(ctx) {
      const id = parseInt(ctx.args[0]);
      if (isNaN(id)) return ctx.reply({ embeds: [error('Usage: delwarn <id>')] });
      db.prepare('DELETE FROM warns WHERE guild_id=? AND id=?').run(ctx.guild.id, id);
      await ctx.reply({ embeds: [ok(`Deleted warn #${id}.`)] });
    },
  },
  {
    name: 'bans',
    admin: true,
    async run(ctx) {
      const bans = await ctx.guild.bans.fetch();
      if (!bans.size) return ctx.reply({ embeds: [info('No bans.')] });
      const e = new EmbedBuilder()
        .setColor(C.err)
        .setTitle(`Bans (${bans.size})`)
        .setDescription(bans.first(20).map((b) => `**${b.user.tag}** — ${b.reason ?? 'none'}`).join('\n'));
      await ctx.reply({ embeds: [e] });
    },
  },
  {
    name: 'purge',
    aliases: ['clear'],
    admin: true,
    async run(ctx) {
      const n = Math.min(parseInt(ctx.args[0]) || 10, 100);
      const msgs = await ctx.channel.bulkDelete(n, true);
      await ctx.reply({ embeds: [ok(`🧹 Deleted ${msgs.size} messages.`)] });
    },
  },
  {
    name: 'lock',
    admin: true,
    async run(ctx) {
      await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: false });
      await ctx.reply({ embeds: [ok('🔒 Locked.')] });
    },
  },
  {
    name: 'unlock',
    admin: true,
    async run(ctx) {
      await ctx.channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: null });
      await ctx.reply({ embeds: [ok('🔓 Unlocked.')] });
    },
  },
  {
    name: 'slowmode',
    admin: true,
    async run(ctx) {
      const s = parseInt(ctx.args[0]) || 0;
      await ctx.channel.setRateLimitPerUser(s);
      await ctx.reply({ embeds: [ok(`Slowmode: **${s}s**`)] });
    },
  },
];

module.exports = commands;
