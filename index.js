const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
} = require('discord.js')
const fetch = require('node-fetch')
const schedule = require('node-schedule')

dotenv.config()

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
})

client.commands = new Collection()

const foldersPath = path.join(__dirname, 'commands')
const commandFolders = fs.readdirSync(foldersPath)
const EVENTS_API_URL = process.env.AUTO_FETCH_EVENTS
const NEWS_API_URL = process.env.AUTO_FETCH_NEWS
const EVENTS_JSON_FILE_PATH = '/data/events_data.json'
const NEWS_JSON_FILE_PATH = '/data/news_data.json'
const CHECK_INTERVAL = 10 * 60 * 1000
const EVENTS_CHANNEL_ID = process.env.EVENTS_CHANNEL_ID
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID
const REMINDER_CHANNEL_ID = process.env.REMINDER_CHANNEL_ID
const CONSEILLER_ROLE_ID = process.env.CONSEILLER_ROLE_ID
const MEMBRE_ROLE_ID = process.env.MEMBRE_ROLE_ID

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder)
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'))
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file)
    const command = require(filePath)
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command)
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      )
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const command = interaction.client.commands.get(interaction.commandName)

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`)
    return
  }

  try {
    await command.execute(interaction)
  } catch (error) {
    console.error(error)
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      })
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      })
    }
  }
})

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`)
  // Initial checks
  checkForEventsUpdates()
  checkForNewsUpdates()
  // Periodical checks
  setInterval(checkForEventsUpdates, CHECK_INTERVAL)
  setInterval(checkForNewsUpdates, CHECK_INTERVAL)

  schedule.scheduleJob('00 10 * * 1,4', async () => {
    const reminderChannel = await client.channels.fetch(REMINDER_CHANNEL_ID)
    await reminderChannel.send(
      `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\n:rotating_light: ***RAPPEL*** :rotating_light: Inscrivez-vous pour le raid de ce soir si ce n'est pas encore fait !`,
    )
  })
})

// Helper function to fetch all pages of data
async function fetchAllPages(url) {
  let allData = []
  let nextPageUrl = url

  while (nextPageUrl) {
    const response = await fetch(nextPageUrl)
    if (!response.ok) throw new Error('Failed to fetch JSON data')

    const jsonResponse = await response.json()
    allData = allData.concat(jsonResponse.items || [])
    nextPageUrl = jsonResponse.links.next || null
  }

  return allData
}

async function checkForEventsUpdates() {
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

async function checkForNewsUpdates() {
  try {
    const newData = await fetchAllPages(NEWS_API_URL)

    if (!Array.isArray(newData)) {
      console.error('Error: Expected an array but got:', typeof newData)
      return
    }

    // Load the old data from file
    let oldData = []
    if (fs.existsSync(NEWS_JSON_FILE_PATH)) {
      oldData = JSON.parse(fs.readFileSync(NEWS_JSON_FILE_PATH, 'utf-8'))
    }

    // Find new entries (check by `id`)
    const newEntries = newData.filter(
      (newItem) => !oldData.some((oldItem) => oldItem.id === newItem.id),
    )

    // Send Discord message for new entries (if any)
    if (newEntries.length > 0) {
      const channel = await client.channels.fetch(NEWS_CHANNEL_ID)
      for (const entry of newEntries) {
        const newsUrl = `${process.env.NEWS}/${entry.slug}`

        // Format the date to be more readable
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

        // Create the embed message with EmbedBuilder
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

        // Send the embed to the channel
        await channel.send({ embeds: [embed] })
      }
    }

    // Save the new JSON only if new data is found
    if (newEntries.length > 0) {
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

// Helper function to get the time remaining in a readable format
function getTimeRemaining(eventDate) {
  // Difference in milliseconds
  const now = new Date()
  const timeDiff = eventDate - now

  if (timeDiff <= 0) {
    return 'Event already started!'
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

client.login(process.env.TOKEN)
