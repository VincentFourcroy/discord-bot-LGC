const { SlashCommandBuilder } = require('discord.js')
const { website } = require('../../config.json')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('site')
    .setDescription('Le site officiel du LGC !'),
  async execute(interaction) {
    await interaction.reply(`${website}`)
  },
}
