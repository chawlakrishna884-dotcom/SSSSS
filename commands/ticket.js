const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, settings } = require('../db');
const { C, ok, error } = require('../utils/embeds');

const commands = [
  {
    name: 'middleman',
    aliases: ['mm', 'panel'],
    admin: true,
    async run(ctx) {
      const e = new EmbedBuilder()
        .setColor(C.dark)
        .setTitle('Middleman Tickets')
        .setDescription(
          'Our Middleman Bot is designed to provide a **secure, efficient, and trustworthy** ' +
            'trading experience for all users. By acting as a neutral third party, the bot helps ' +
            'ensure both parties fulfill their agreements before any assets, items, accounts, ' +
            'currency, or services are exchanged.\n\n' +
            '✅ Secure trade management\n' +
            '✅ Transparent transaction process\n' +
            '✅ Reduced risk of scams and fraud\n' +
            '✅ Fast and reliable ticket support\n' +
            '✅ Professional moderation oversight\n\n' +
            'The goal of this service is to create a safe environment where members can trade ' +
            'with confidence and peace of mind.'
        )
        .setFooter({ text: ctx.guild.name });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:open:middleman')
          .setLabel('Request Middleman')
          .setEmoji('🤝')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket:open:support')
          .setLabel('Support')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Secondary)
      );

      await ctx.send({ embeds: [e], components: [row] });
      if (ctx.kind === 'slash') await ctx.reply({ content: 'Panel posted.', ephemeral: true });
    },
  },
  {
    name: 'panelconfig',
    admin: true,
    async run(ctx) {
      const s = settings(ctx.guild.id);
      const ch = ctx.message?.mentions.channels.first();
      if (ch) {
        db.prepare('UPDATE settings SET ticket_category=? WHERE guild_id=?').run(ch.id, ctx.guild.id);
      }
      const cat = s.ticket_category ? `<#${s.ticket_category}>` : 'none';
      await ctx.reply({
        embeds: [
          ok(
            `Ticket category: ${cat}\nTickets opened: ${s.ticket_counter}\n` +
              `Set category with \`${s.prefix}panelconfig #category\``
          ),
        ],
      });
    },
  },
  {
    name: 'ticketlockchat',
    aliases: ['lockchat'],
    admin: true,
    async run(ctx) {
      const s = settings(ctx.guild.id);
      const next = s.ticketlockchat ? 0 : 1;
      db.prepare('UPDATE settings SET ticketlockchat=? WHERE guild_id=?').run(next, ctx.guild.id);
      await ctx.reply({ embeds: [ok(`Ticket chat lock: **${next ? 'on' : 'off'}**`)] });
    },
  },
  {
    name: 'close',
    aliases: ['cl'],
    async run(ctx) {
      const t = db
        .prepare('SELECT * FROM tickets WHERE channel_id=? AND status=?')
        .get(ctx.channel.id, 'open');
      if (!t) return ctx.reply({ embeds: [error('Not a ticket channel.')] });
      db.prepare('UPDATE tickets SET status=? WHERE id=?').run('closed', t.id);
      await ctx.reply({ embeds: [ok('Closing in 5 seconds.')] });
      setTimeout(() => ctx.channel.delete().catch(() => {}), 5000);
    },
  },
  {
    name: 'add',
    async run(ctx) {
      const target = ctx.message?.mentions.users.first();
      if (!target) return ctx.reply({ embeds: [error('Mention a user.')] });
      await ctx.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      await ctx.reply({ embeds: [ok(`Added <@${target.id}>.`)] });
    },
  },
  {
    name: 'remove',
    async run(ctx) {
      const target = ctx.message?.mentions.users.first();
      if (!target) return ctx.reply({ embeds: [error('Mention a user.')] });
      await ctx.channel.permissionOverwrites.edit(target.id, { ViewChannel: false });
      await ctx.reply({ embeds: [ok(`Removed <@${target.id}>.`)] });
    },
  },
  {
    name: 'rename',
    async run(ctx) {
      const name = ctx.args.join(' ') || 'ticket';
      await ctx.channel.setName(name.slice(0, 90));
      await ctx.reply({ embeds: [ok(`Renamed to **${name}**.`)] });
    },
  },
];

module.exports = commands;
