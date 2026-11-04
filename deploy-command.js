require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const body = [];
for (const file of fs.readdirSync(path.join(__dirname, 'commands'))) {
  if (!file.endsWith('.js')) continue;
  for (const cmd of require(path.join(__dirname, 'commands', file))) {
    if (!cmd.slash) continue;
    body.push({
      name: cmd.name,
      description: cmd.description || cmd.name,
      options: cmd.options || [],
    });
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);
  await rest.put(route, { body });
  console.log(`Registered ${body.length} slash commands.`);
})();
