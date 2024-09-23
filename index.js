const { token, website } = require('./config.json')
const {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
} = require('discord.js')

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`)

  const ping = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with "Pong!"')

  const pew = new SlashCommandBuilder()
    .setName('pew')
    .setDescription('Pew pew!')

  const website = new SlashCommandBuilder()
    .setName('site')
    .setDescription('Le site officiel du LGC !')

  client.application.commands.create(ping, '821472419227107378')
  client.application.commands.create(pew, '821472419227107378')
  client.application.commands.create(website, '821472419227107378')
})

client.on(Events.InteractionCreate, (interaction) => {
  if (!interaction.isChatInputCommand()) return
  if (interaction.commandName === 'ping') {
    interaction.reply('Pong!')
  }
  if (interaction.commandName === 'pew') {
    interaction.reply(':gun: :gun: Pew pew!')
  }
  if (interaction.commandName === 'site') {
    interaction.reply(`${website}`)
  }
})

client.login(token)
