const { SlashCommandBuilder } = require('discord.js')
const dotenv = require('dotenv')

dotenv.config()

module.exports = {
  data: new SlashCommandBuilder()
    .setName('site')
    .setDescription('Le site officiel du LGC !'),
  async execute(interaction) {
    await interaction.reply(`${process.env.WEBSITE}`)
  },
}
