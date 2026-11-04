const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const file = process.env.DB_PATH || './data/bot.db';
fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT DEFAULT '!',
  vouch_channel TEXT,
  vouch_dm INTEGER DEFAULT 1,
  ticket_category TEXT,
  ticket_counter INTEGER DEFAULT 0,
  ticketlockchat INTEGER DEFAULT 0,
  welcome_channel TEXT,
  welcome_message TEXT,
  post_channel TEXT,
  log_channel TEXT
);
CREATE TABLE IF NOT EXISTS users (
  guild_id TEXT, user_id TEXT,
  vouches INTEGER DEFAULT 0,
  is_immune INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);
CREATE TABLE IF NOT EXISTS ranks (
  guild_id TEXT, threshold INTEGER, role_id TEXT, label TEXT,
  PRIMARY KEY (guild_id, threshold)
);
CREATE TABLE IF NOT EXISTS perms (
  guild_id TEXT, role_id TEXT, cmd TEXT,
  PRIMARY KEY (guild_id, role_id, cmd)
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, channel_id TEXT, owner_id TEXT, number INTEGER,
  kind TEXT, claimed_by TEXT, status TEXT DEFAULT 'open', created_at INTEGER
);
CREATE TABLE IF NOT EXISTS warns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, user_id TEXT, mod_id TEXT, reason TEXT, at INTEGER
);
CREATE TABLE IF NOT EXISTS vouch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, from_id TEXT, to_id TEXT, note TEXT, at INTEGER
);
CREATE TABLE IF NOT EXISTS autoresponders (
  guild_id TEXT, trigger TEXT, response TEXT,
  PRIMARY KEY (guild_id, trigger)
);
CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, channel_id TEXT, message_id TEXT, prize TEXT,
  winners INTEGER, host_id TEXT, ends_at INTEGER, ended INTEGER DEFAULT 0
);
`);

function settings(guildId) {
  let s = db.prepare('SELECT * FROM settings WHERE guild_id=?').get(guildId);
  if (!s) {
    db.prepare('INSERT INTO settings (guild_id) VALUES (?)').run(guildId);
    s = db.prepare('SELECT * FROM settings WHERE guild_id=?').get(guildId);
  }
  return s;
}

function user(guildId, userId) {
  db.prepare(`INSERT INTO users (guild_id,user_id) VALUES (?,?)
    ON CONFLICT(guild_id,user_id) DO NOTHING`).run(guildId, userId);
  return db.prepare('SELECT * FROM users WHERE guild_id=? AND user_id=?').get(guildId, userId);
}

module.exports = { db, settings, user };
