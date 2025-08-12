const fs = require('node:fs')
const { EmbedBuilder } = require('discord.js')
const { fetchAllPages } = require('../utils/fetch')

const EVENTS_API_URL = process.env.AUTO_FETCH_EVENTS
const EVENTS_JSON_FILE_PATH = './data/events_data.json'
const EVENTS_CHANNEL_ID = process.env.EVENTS_CHANNEL_ID

// Helper function to get the time remaining in a readable format
function getTimeRemaining(eventDate) {
  // Difference in milliseconds
  const now = new Date()
  const timeDiff = eventDate - now

  if (timeDiff <= 0) {
    return "L'événement a déjà commencé ou est terminé !"
  }

  const daysRemaining = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
  const hoursRemaining = Math.floor(
    (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  )
  const minutesRemaining = Math.floor(
    (timeDiff % (1000 * 60 * 60)) / (1000 * 60),
  )

  return `${daysRemaining} jours, ${hoursRemaining} heures, ${minutesRemaining} minutes`
}

async function checkForEventsUpdates(client) {
  try {
    const newData = await fetchAllPages(EVENTS_API_URL)

    if (!Array.isArray(newData)) {
      console.error('Error: Expected an array but got:', typeof newData)
      return
    }

    // Load the old data from file
    let oldData = []
    if (fs.existsSync(EVENTS_JSON_FILE_PATH)) {
      oldData = JSON.parse(fs.readFileSync(EVENTS_JSON_FILE_PATH, 'utf-8'))
    }

    // Find new entries (check by `id`)
    const newEntries = newData.filter(
      (newItem) => !oldData.some((oldItem) => oldItem.id === newItem.id),
    )

    // Send Discord message for new entries (if any)
    if (newEntries.length > 0) {
      const channel = await client.channels.fetch(EVENTS_CHANNEL_ID)
      for (const entry of newEntries) {
        const eventUrl = `${process.env.EVENTS}/${entry.id}`
        const date = new Date(entry.startsAt)
        const readableDate = new Intl.DateTimeFormat('fr-FR', {
          timeZone: 'Europe/Paris',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date)

        let timeRemaining = getTimeRemaining(date)

        const embed = new EmbedBuilder()
          .setColor(entry.eventType?.color)
          .setImage(entry.asset?.filenameUrl)
          .setTitle(entry.title)
          .setURL(eventUrl)
          .setAuthor({ name: 'Le Grand Conseil', url: process.env.WEBSITE })
          .setDescription(entry.description || 'No description available')
          .addFields(
            { name: '\u200B', value: `:calendar_spiral: ${readableDate}` },
            { name: '\u200B', value: `:hourglass: ${timeRemaining}` },
          )

        const message = await channel.send({ embeds: [embed] })
        const interval = setInterval(async () => {
          timeRemaining = getTimeRemaining(date)

          if (new Date() >= date) {
            clearInterval(interval)
            return
          }

          const updatedEmbed = EmbedBuilder.from(embed).setFields(
            { name: '\u200B', value: `:calendar_spiral: ${readableDate}` },
            { name: '\u200B', value: `:hourglass: ${timeRemaining}` },
          )

          await message.edit({ embeds: [updatedEmbed] })
        }, 60000)
      }
    }

    // Save the new JSON only if new data is found
    if (newEntries.length > 0) {
      const updatedData = [...oldData, ...newEntries]
      fs.writeFileSync(
        EVENTS_JSON_FILE_PATH,
        JSON.stringify(updatedData, null, 2),
      )
      console.log('✅ Events JSON data updated successfully.')
    } else {
      console.warn('⚠️ No new events data found. Skipping file update.')
    }
  } catch (error) {
    console.error('❌ Error fetching or processing events JSON:', error)
  }
}

module.exports = { checkForEventsUpdates }
