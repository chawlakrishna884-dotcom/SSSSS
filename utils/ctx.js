const { PermissionsBitField } = require('discord.js');
const { db, settings, user } = require('../db');

const FLAGS = PermissionsBitField.Flags;

function fromMessage(message, prefix) {
  const raw = message.content.slice(prefix.length).trim();
  const parts = raw.split(/\s+/);
  const name = (parts.shift() || '').toLowerCase();
  return {
    kind: 'message',
    guild: message.guild,
    channel: message.channel,
    member: message.member,
    user: message.author,
    message,
    name,
    args: parts,
    raw,
    reply: (opts) => message.reply(opts),
    send: (opts) => message.channel.send(opts),
  };
}

function fromInteraction(interaction) {
  return {
    kind: 'slash',
    guild: interaction.guild,
    channel: interaction.channel,
    member: interaction.member,
    user: interaction.user,
    interaction,
    name: interaction.commandName,
    args: [],
    raw: '',
    reply: (opts) =>
      interaction.replied || interaction.deferred
        ? interaction.followUp(opts)
        : interaction.reply(opts),
    send: (opts) => interaction.channel.send(opts),
  };
}

function isStaff(ctx) {
  if (!ctx.member) return false;
  if (ctx.member.permissions.has(FLAGS.Administrator)) return true;
  if (ctx.member.permissions.has(FLAGS.ManageGuild)) return true;
  const u = user(ctx.guild.id, ctx.user.id);
  if (u.is_immune) return true;
  const roles = ctx.member.roles.cache.map((r) => r.id);
  if (!roles.length) return false;
  const row = db
    .prepare(
      `SELECT 1 FROM perms WHERE guild_id=? AND cmd IN ('*', ?) AND role_id IN (${roles
        .map(() => '?')
        .join(',')}) LIMIT 1`
    )
    .get(ctx.guild.id, ctx.name, ...roles);
  return Boolean(row);
}

function hasPerm(ctx, cmd) {
  if (!cmd.admin) return true;
  return isStaff(ctx);
}

module.exports = { fromMessage, fromInteraction, isStaff, hasPerm, settings };
