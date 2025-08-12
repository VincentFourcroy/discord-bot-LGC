const dotenv = require('dotenv')
const { Client, GatewayIntentBits } = require('discord.js')
const commandHandler = require('./handlers/commandHandler')
const eventHandler = require('./handlers/eventHandler')

dotenv.config()

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
})

commandHandler(client)
eventHandler(client)

client.login(process.env.TOKEN)
