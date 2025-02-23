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

dotenv.config()

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
})

client.commands = new Collection()

const foldersPath = path.join(__dirname, 'commands')
const commandFolders = fs.readdirSync(foldersPath)
const API_URL = process.env.AUTO_FETCH_EVENTS
const JSON_FILE_PATH = './data.json'
const CHECK_INTERVAL = 10 * 60 * 1000 // 10 minutes in milliseconds
const CHANNEL_ID = process.env.CHANNEL_ID

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
  checkForUpdates() // Initial check
  setInterval(checkForUpdates, CHECK_INTERVAL)
})

async function checkForUpdates() {
  try {
    const response = await fetch(API_URL)
    if (!response.ok) throw new Error('Failed to fetch JSON data')

    const jsonResponse = await response.json()
    console.log(
      'Fetched Data Structure:',
      JSON.stringify(jsonResponse, null, 2),
    ) // Debugging

    // ✅ Correctly extract the array from `items`
    const newData = jsonResponse.items || []
    console.log('Extracted Data:', newData)

    if (!Array.isArray(newData)) {
      console.error('Error: Expected an array but got:', typeof newData)
      return
    }

    // Load the old data from file
    let oldData = []
    if (fs.existsSync(JSON_FILE_PATH)) {
      oldData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf-8'))
    }
    console.log('Old Data:', oldData)

    // Find new entries (check by `id`)
    const newEntries = newData.filter(
      (newItem) => !oldData.some((oldItem) => oldItem.id === newItem.id),
    )
    console.log('New Entries Found:', newEntries)

    // Send Discord message for new entries (if any)
    if (newEntries.length > 0) {
      const channel = await client.channels.fetch(CHANNEL_ID)
      for (const entry of newEntries) {
        const eventUrl = `https://guilde-lgc.fr/events/${entry.id}`

        // Format the date to be more readable
        const date = new Date(entry.startsAt)
        const readableDate = date.toLocaleString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        // Calculate the time remaining
        const timeRemaining = getTimeRemaining(date)

        // Create the embed message with EmbedBuilder
        const embed = new EmbedBuilder()
          .setColor('#FF33F5')
          .setImage(entry.asset?.filenameUrl)
          .setTitle(entry.title)
          .setURL(eventUrl)
          .setDescription(entry.description || 'No description available')
          .addFields(
            { name: '\u200B', value: `:calendar_spiral: ${readableDate}` },
            { name: '\u200B', value: `:hourglass: ${timeRemaining}` },
          )

        // Send the embed to the channel
        const message = await channel.send({ embeds: [embed] })
        // Function to update time remaining dynamically every minute
        const interval = setInterval(() => {
          const newTimeRemaining = getTimeRemaining(date) // Get the updated time remaining

          // Edit the message with the new time remaining
          message.edit({
            embeds: [
              embed.setFields(
                { name: '\u200B', value: `:calendar_spiral: ${readableDate}` },
                {
                  name: '\u200B',
                  value: `:hourglass: ${timeRemaining}`,
                },
              ),
            ],
          })

          // Stop updating when the event starts
          if (new Date() >= date) {
            clearInterval(interval) // Stop the interval when the event starts
          }
        }, 60000) // Update every minute (60000 ms)
      }
    }

    // ✅ Save the new JSON only if new data is found
    if (newData.length > 0) {
      fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(newData, null, 2))
      console.log('✅ JSON data updated successfully.')
    } else {
      console.warn('⚠️ No new data found. Skipping file update.')
    }
  } catch (error) {
    console.error('❌ Error fetching or processing JSON:', error)
  }
}

// Helper function to get the time remaining in a readable format
function getTimeRemaining(eventDate) {
  const now = new Date()
  const timeDiff = eventDate - now // Difference in milliseconds

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
