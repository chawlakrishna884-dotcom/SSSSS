const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');
const { db, settings } = require('../db');
const { C } = require('../utils/embeds');

module.exports = async function handleButton(i) {
  const s = settings(i.guild.id);

  if (i.customId.startsWith('ticket:open:')) {
    const kind = i.customId.split(':')[2];
    const number = s.ticket_counter + 1;
    db.prepare('UPDATE settings SET ticket_counter=? WHERE guild_id=?').run(
      number,
      i.guild.id
    );

    const ch = await i.guild.channels.create({
      name: `${kind}-${String(number).padStart(4, '0')}`,
      type: ChannelType.GuildText,
      parent: s.ticket_category || null,
      permissionOverwrites: [
        { id: i.guild.id, deny: ['ViewChannel'] },
        { id: i.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
      ],
    });

    db.prepare(
      `INSERT INTO tickets (guild_id,channel_id,owner_id,number,kind,created_at)
       VALUES (?,?,?,?,?,?)`
    ).run(i.guild.id, ch.id, i.user.id, number, kind, Date.now());

    const embed = new EmbedBuilder()
      .setColor(C.dark)
      .setTitle(`Ticket #${String(number).padStart(4, '0')}`)
      .setDescription(
        `<@${i.user.id}> thanks for opening a ticket.\n\n` +
          (kind === 'middleman'
            ? 'A middleman will claim this shortly. Please state:\n> what you are trading\n> who you are trading with\n> who goes first'
            : 'Support will be with you shortly. Describe your issue.')
      )
      .setFooter({ text: i.guild.name })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setEmoji('📌').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );

    await ch.send({ content: `<@${i.user.id}>`, embeds: [embed], components: [row] });
    return i.reply({ content: `Ticket opened: <#${ch.id}>`, ephemeral: true });
  }

  const ticket = db
    .prepare('SELECT * FROM tickets WHERE channel_id=? AND status=?')
    .get(i.channel.id, 'open');
  if (!ticket) return i.reply({ content: 'No open ticket here.', ephemeral: true });

  if (i.customId === 'ticket:claim') {
    if (ticket.claimed_by) {
      return i.reply({ content: `Already claimed by <@${ticket.claimed_by}>.`, ephemeral: true });
    }
    db.prepare('UPDATE tickets SET claimed_by=? WHERE id=?').run(i.user.id, ticket.id);
    await i.channel.setName(`${i.channel.name.replace(/^claimed-/, '')}-claimed`).catch(() => {});
    return i.update({
      content: `📌 Claimed by <@${i.user.id}> — <@${ticket.owner_id}>`,
      embeds: i.message.embeds,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        ),
      ],
    });
  }

  if (i.customId === 'ticket:close') {
    db.prepare('UPDATE tickets SET status=? WHERE id=?').run('closed', ticket.id);
    await i.reply({ content: '🔒 Closing in 5 seconds.' });
    setTimeout(() => i.channel.delete().catch(() => {}), 5000);
  }
};
