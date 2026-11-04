require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
} = require('discord.js');

const { db, settings, user } = require('./db');
const { fromMessage, fromInteraction, hasPerm } = require('./utils/ctx');
const { C, error } = require('./utils/embeds');
const handleButton = require('./handlers/buttons');
const snipe = require('./utils/snipe');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

const commands = new Collection();

for (const file of fs.readdirSync(path.join(__dirname, 'commands'))) {
  if (!file.endsWith('.js')) continue;
  const mod = require(path.join(__dirname, 'commands', file));
  for (const cmd of mod) {
    commands.set(cmd.name, cmd);
    for (const a of cmd.aliases ?? []) commands.set(a, cmd);
  }
}

module.exports = { client, commands };

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag} | ${commands.size} command keys`);
  c.user.setPresence({ activities: [{ name: 'middleman tickets', type: 3 }] });
});

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isButton()) return await handleButton(i);
    if (!i.isChatInputCommand()) return;

    const cmd = commands.get(i.commandName);
    if (!cmd) return;

    const ctx = fromInteraction(i);
    ctx.client = client;

    if (!hasPerm(ctx, cmd)) {
      return i.reply({ embeds: [error('You lack permission for this.')], ephemeral: true });
    }

    await cmd.run(ctx);
  } catch (e) {
    console.error(e);
    const payload = { embeds: [error('Command failed.')], ephemeral: true };
    if (i.replied || i.deferred) i.followUp(payload).catch(() => {});
    else i.reply(payload).catch(() => {});
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const s = settings(message.guild.id);
  const prefix = s.prefix;

  if (!message.content.startsWith(prefix)) {
    const trigger = message.content.toLowerCase().trim();
    if (trigger) {
      const ar = db
        .prepare('SELECT * FROM autoresponders WHERE guild_id=? AND trigger=?')
        .get(message.guild.id, trigger);
      if (ar) message.reply(ar.response).catch(() => {});
    }
    return;
  }

  const ctx = fromMessage(message, prefix);
  ctx.client = client;

  const cmd = commands.get(ctx.name);
  if (!cmd) return;

  if (!hasPerm(ctx, cmd)) {
    return message.reply({ embeds: [error('You lack permission for this.')] }).catch(() => {});
  }

  if (cmd.admin && ctx.member?.permissions.has('ManageMessages')) {
    message.delete().catch(() => {});
  }

  try {
    await cmd.run(ctx);
  } catch (e) {
    console.error(e);
    message.reply({ embeds: [error('Command failed.')] }).catch(() => {});
  }
});

client.on(Events.MessageDelete, (message) => {
  if (message.partial || message.author?.bot) return;
  snipe.set(message.channel.id, {
    author: message.author.tag,
    avatar: message.author.displayAvatarURL(),
    content: message.content,
    image: message.attachments.first()?.url ?? null,
    at: Date.now(),
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  const s = settings(member.guild.id);
  if (!s.welcome_channel) return;
  const ch = await member.guild.channels.fetch(s.welcome_channel).catch(() => null);
  if (!ch) return;

  const text = (s.welcome_message || 'Welcome {user} to {guild}!')
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{guild}/g, member.guild.name);

  const e = new EmbedBuilder()
    .setColor(C.dark)
    .setAuthor({ name: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
    .setTitle('Welcome to the server!')
    .setDescription(`${text}\n\nRead the rules and open a ticket to trade.`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  ch.send({ content: `<@${member.id}>`, embeds: [e] }).catch(() => {});
});

client.on(Events.GuildMemberRemove, () => {});

process.on('unhandledRejection', (e) => console.error('Unhandled:', e));

client.login(process.env.TOKEN);
