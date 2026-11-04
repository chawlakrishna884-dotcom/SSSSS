# MM Bot

Discord middleman bot with vouches, rank ladder, ticket panels, moderation and giveaways.

## Setup

1. Create an app at https://discord.com/developers/applications
2. Bot tab → enable **Server Members Intent**, **Message Content Intent**, **Presence Intent**
3. Copy the token
4. Invite with scopes `bot` + `applications.commands`, Administrator

## Local

```bash
cp .env.example .env
npm install
npm run deploy
npm start
```

## Railway

1. Push to GitHub
2. Railway → New Project → Deploy from GitHub
3. Variables: `TOKEN`, `CLIENT_ID`, `DB_PATH=/data/bot.db`
4. Add a **Volume** mounted at `/data`
5. Run `npm run deploy` once from the Railway shell

## First run

```
!vouchchannel #vouches
!welcome #welcome
!rankrole 25 @Verified Verified
!rankrole 100 @Trusted Trusted
!middleman
```
