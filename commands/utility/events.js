const { SlashCommandBuilder } = require('discord.js')
const { events } = require('../../config.json')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('events')
    .setDescription('Le calendrier des événements de la guilde.'),
  async execute(interaction) {
    await interaction.reply(`${events}`)
  },
}
