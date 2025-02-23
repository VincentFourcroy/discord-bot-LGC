const { SlashCommandBuilder } = require('discord.js')
const dotenv = require('dotenv')

dotenv.config()

module.exports = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('Le calendrier des events de guilde.'),
  async execute(interaction) {
    await interaction.reply(`${process.env.EVENTS}`)
  },
}
