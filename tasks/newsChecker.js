const fs = require('node:fs')
const { EmbedBuilder } = require('discord.js')
const { fetchAllPages } = require('../utils/fetch')

const NEWS_API_URL = process.env.AUTO_FETCH_NEWS
const NEWS_JSON_FILE_PATH = './data/news_data.json'
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID

async function checkForNewsUpdates(client) {
  try {
    const newData = await fetchAllPages(NEWS_API_URL)

    if (!Array.isArray(newData)) {
      console.error(
        'Error: Expected an array for news, but got:',
        typeof newData,
      )
      return
    }

    let oldData = []
    if (fs.existsSync(NEWS_JSON_FILE_PATH)) {
      oldData = JSON.parse(fs.readFileSync(NEWS_JSON_FILE_PATH, 'utf-8'))
    }

    const newEntries = newData.filter(
      (newItem) => !oldData.some((oldItem) => oldItem.id === newItem.id),
    )

    if (newEntries.length > 0) {
      const channel = await client.channels.fetch(NEWS_CHANNEL_ID)
      for (const entry of newEntries) {
        const newsUrl = `${process.env.NEWS}/${entry.slug}`
        const date = new Date(entry.publishedAt)
        const readableDate = new Intl.DateTimeFormat('fr-FR', {
          timeZone: 'Europe/Paris',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date)

        const embed = new EmbedBuilder()
          .setColor(entry.postCategory?.color)
          .setImage(entry.asset?.filenameUrl)
          .setTitle(entry.title)
          .setURL(newsUrl)
          .setAuthor({ name: 'Le Grand Conseil', url: process.env.WEBSITE })
          .setDescription(entry.excerpt || 'No description available')
          .addFields({
            name: '\u200B',
            value: `:pencil: Publié le ${readableDate} par ${entry.user.nickname}`,
          })

        await channel.send({ embeds: [embed] })
      }
      const updatedData = [...oldData, ...newEntries]
      fs.writeFileSync(
        NEWS_JSON_FILE_PATH,
        JSON.stringify(updatedData, null, 2),
      )
      console.log('✅ News JSON data updated successfully.')
    } else {
      console.warn('⚠️ No new news data found. Skipping file update.')
    }
  } catch (error) {
    console.error('❌ Error fetching or processing news JSON:', error)
  }
}

module.exports = { checkForNewsUpdates }
