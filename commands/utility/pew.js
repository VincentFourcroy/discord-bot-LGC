const { SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder().setName('pew').setDescription('Pew Pew!'),
  async execute(interaction) {
    await interaction.reply(':gun: :gun: Pew pew!')
  },
}
