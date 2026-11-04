const { EmbedBuilder } = require('discord.js');

const colors = {
  primary: 0x5865f2,
  success: 0x57f287,
  error: 0xed4245,
  warn: 0xfee75c,
  info: 0x3498db,
};

function base(color, title, description) {
  const e = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) e.setTitle(String(title).slice(0, 256));
  if (description) e.setDescription(String(description).slice(0, 4096));
  return e;
}

const embed = (title, description, color = colors.primary) => base(color, title, description);
const success = (description, title = 'Success') => base(colors.success, `✅ ${title}`, description);
const error = (description, title = 'Error') => base(colors.error, `❌ ${title}`, description);
const warn = (description, title = 'Warning') => base(colors.warn, `⚠️ ${title}`, description);
const info = (description, title = 'Info') => base(colors.info, `ℹ️ ${title}`, description);

module.exports = {
  colors,
  embed,
  base,
  success,
  error,
  warn,
  info,
  // aliases in case your code uses other names
  successEmbed: success,
  errorEmbed: error,
  warnEmbed: warn,
  infoEmbed: info,
  makeEmbed: embed,
};
