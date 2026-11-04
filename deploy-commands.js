require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const body = [];
const seen = new Set();

for (const file of fs.readdirSync(path.join(__dirname, 'commands'))) {
  if (!file.endsWith('.js')) continue;
  const mod = require(path.join(__dirname, 'commands', file));
  const list = Array.isArray(mod) ? mod : [mod];

  for (const cmd of list) {
    if (!cmd || !cmd.name) continue;
    const name = String(cmd.name).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    body.push({
      name,
      description: String(cmd.description || name).slice(0, 100),
      options: cmd.options || [],
    });
  }
}

if (body.length > 100) {
  console.warn(`Discord allows only 100 slash commands, you have ${body.length}. Extra ones will be dropped.`);
  body.length = 100;
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);
  await rest.put(route, { body });
  console.log(`Registered ${body.length} slash commands.`);
})();t.put(route, { body });
  console.log(`Registered ${body.length} slash commands.`);
})();
