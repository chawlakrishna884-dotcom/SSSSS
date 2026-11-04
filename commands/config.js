const { db, settings } = require('../db');
const { ok, error } = require('../utils/embeds');

const commands = [
  {
    name: 'prefix',
    admin: true,
    async run(ctx) {
      const p = ctx.args[0];
      if (!p || p.length > 3) return ctx.reply({ embeds: [error('Usage: prefix <symbol>')] });
      settings(ctx.guild.id);
      db.prepare('UPDATE settings SET prefix=? WHERE guild_id=?').run(p, ctx.guild.id);
      await ctx.reply({ embeds: [ok(`Prefix set to \`${p}\``)] });
    },
  },
  {
    name: 'perm',
    admin: true,
    async run(ctx) {
      const role = ctx.message?.mentions.roles.first();
      const cmd = (ctx.args[1] || '').replace(/^--?/, '').toLowerCase();
      if (!role || !cmd) return ctx.reply({ embeds: [error('Usage: perm @role --command')] });
      db.prepare('INSERT OR IGNORE INTO perms (guild_id,role_id,cmd) VALUES (?,?,?)').run(
        ctx.guild.id,
        role.id,
        cmd
      );
      await ctx.reply({ embeds: [ok(`${role} can now use \`${cmd}\`.`)] });
    },
  },
  {
    name: 'unperm',
    admin: true,
    async run(ctx) {
      const role = ctx.message?.mentions.roles.first();
      const cmd = (ctx.args[1] || '').replace(/^--?/, '').toLowerCase();
      if (!role || !cmd) return ctx.reply({ embeds: [error('Usage: unperm @role --command')] });
      db.prepare('DELETE FROM perms WHERE guild_id=? AND role_id=? AND cmd=?').run(
        ctx.guild.id,
        role.id,
        cmd
      );
      await ctx.reply({ embeds: [ok(`Removed \`${cmd}\` from ${role}.`)] });
    },
  },
  {
    name: 'permall',
    admin: true,
    async run(ctx) {
      const role = ctx.message?.mentions.roles.first();
      if (!role) return ctx.reply({ embeds: [error('Usage: permall @role --cmd1 --cmd2')] });
      const cmds = ctx.args.slice(1).map((a) => a.replace(/^--?/, '').toLowerCase());
      if (!cmds.length) return ctx.reply({ embeds: [error('No commands given.')] });
      const stmt = db.prepare('INSERT OR IGNORE INTO perms (guild_id,role_id,cmd) VALUES (?,?,?)');
      for (const c of cmds) stmt.run(ctx.guild.id, role.id, c);
      await ctx.reply({ embeds: [ok(`${role} granted: ${cmds.map((c) => `\`${c}\``).join(', ')}`)] });
    },
  },
  {
    name: 'perms',
    admin: true,
    async run(ctx) {
      const rows = db.prepare('SELECT * FROM perms WHERE guild_id=?').all(ctx.guild.id);
      if (!rows.length) return ctx.reply({ embeds: [ok('No role permissions set.')] });
      await ctx.reply({
        embeds: [
          ok(rows.map((r) => `<@&${r.role_id}> → \`${r.cmd}\``).join('\n')),
        ],
      });
    },
  },
  {
    name: 'welcome',
    admin: true,
    async run(ctx) {
      const ch = ctx.message?.mentions.channels.first();
      if (ch) {
        db.prepare('UPDATE settings SET welcome_channel=? WHERE guild_id=?').run(ch.id, ctx.guild.id);
        return ctx.reply({ embeds: [ok(`Welcome channel: ${ch}`)] });
      }
      const text = ctx.args.join(' ');
      if (!text) return ctx.reply({ embeds: [error('Usage: welcome #channel OR welcome <message>')] });
      db.prepare('UPDATE settings SET welcome_message=? WHERE guild_id=?').run(text, ctx.guild.id);
      await ctx.reply({ embeds: [ok('Welcome message updated. Use `{user}` and `{guild}`.')] });
    },
  },
  {
    name: 'autorespond',
    aliases: ['autoreset', 'ar'],
    admin: true,
    async run(ctx) {
      const [trigger, ...rest] = ctx.raw.split('=>').map((x) => x.trim());
      if (!trigger || !rest.length)
        return ctx.reply({ embeds: [error('Usage: autorespond trigger => response')] });
      db.prepare(
        `INSERT INTO autoresponders (guild_id,trigger,response) VALUES (?,?,?)
         ON CONFLICT(guild_id,trigger) DO UPDATE SET response=excluded.response`
      ).run(ctx.guild.id, trigger.toLowerCase(), rest.join(' => '));
      await ctx.reply({ embeds: [ok(`Autoresponder added for \`${trigger}\`.`)] });
    },
  },
  {
    name: 'delautorespond',
    aliases: ['delar'],
    admin: true,
    async run(ctx) {
      const t = ctx.args.join(' ').toLowerCase();
      db.prepare('DELETE FROM autoresponders WHERE guild_id=? AND trigger=?').run(ctx.guild.id, t);
      await ctx.reply({ embeds: [ok(`Removed \`${t}\`.`)] });
    },
  },
  {
    name: 'postchannel',
    admin: true,
    async run(ctx) {
      const ch = ctx.message?.mentions.channels.first();
      if (!ch) return ctx.reply({ embeds: [error('Mention a channel.')] });
      db.prepare('UPDATE settings SET post_channel=? WHERE guild_id=?').run(ch.id, ctx.guild.id);
      await ctx.reply({ embeds: [ok(`Trade post channel: ${ch}`)] });
    },
  },
];

module.exports = commands;
