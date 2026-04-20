const express = require('express')
const fs = require('node:fs')
const { EmbedBuilder } = require('discord.js')

const WEBSITE_CHANNEL_ID = process.env.WEBSITE_CHANNEL_ID
const EVENTS_CHANNEL_ID = process.env.EVENTS_CHANNEL_ID_TEST
const WEBHOOK_PORT = process.env.WEBHOOK_PORT
const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN
const EVENT_MESSAGES_MAP_PATH = './data/event_messages_map.json'

// Map to store event messages (eventId -> { messageId, channelId, date, readableDate, embed })
let eventMessageMap = new Map()

// Map to store active intervals (eventId -> intervalId)
let eventIntervals = new Map()

// Helper function to load the message map from file
function loadEventMessageMap() {
  try {
    if (fs.existsSync(EVENT_MESSAGES_MAP_PATH)) {
      const data = JSON.parse(fs.readFileSync(EVENT_MESSAGES_MAP_PATH, 'utf-8'))
      eventMessageMap = new Map(Object.entries(data))
      console.log(`✅ Loaded ${eventMessageMap.size} event message mappings`)
    }
  } catch (error) {
    console.error('❌ Error loading event message map:', error)
  }
}

// Helper function to save the message map to file
function saveEventMessageMap() {
  try {
    const data = Object.fromEntries(eventMessageMap)
    fs.writeFileSync(EVENT_MESSAGES_MAP_PATH, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('❌ Error saving event message map:', error)
  }
}

// Helper function to capitalize first letter
function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Helper function to format date in French
function formatFrenchDate(date) {
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  return capitalizeFirstLetter(formatted)
}

// Helper function to get the time remaining in a readable format
function getTimeRemaining(eventDate) {
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

// Helper function to setup or restart event update interval
async function setupEventInterval(client, eventId) {
  // Clear existing interval if any
  if (eventIntervals.has(eventId)) {
    clearInterval(eventIntervals.get(eventId))
    eventIntervals.delete(eventId)
  }

  const eventData = eventMessageMap.get(eventId)
  if (!eventData) return

  const date = new Date(eventData.date)
  const readableDate = eventData.readableDate
  const embed = new EmbedBuilder(eventData.embed)

  // Only setup interval if event hasn't started yet
  if (new Date() >= date) {
    return
  }

  const interval = setInterval(async () => {
    try {
      const timeRemaining = getTimeRemaining(date)

      const channel = await client.channels.fetch(eventData.channelId)
      const message = await channel.messages.fetch(eventData.messageId)

      // Get the current embed from the message
      const currentEmbed = message.embeds[0]
      const updatedEmbed = EmbedBuilder.from(currentEmbed).setFields(
        { name: '\u200B', value: `:calendar_spiral: ${readableDate}` },
        { name: '\u200B', value: `:hourglass: ${timeRemaining}` },
      )

      await message.edit({ embeds: [updatedEmbed] })

      // Update the stored embed with the new one
      eventData.embed = updatedEmbed.toJSON()
      saveEventMessageMap()

      // Check if event started AFTER updating the message
      if (new Date() >= date) {
        clearInterval(interval)
        eventIntervals.delete(eventId)
      }
    } catch (err) {
      console.error(`Error updating event ${eventId}:`, err)
      clearInterval(interval)
      eventIntervals.delete(eventId)
    }
  }, 60000)

  eventIntervals.set(eventId, interval)
}

// Helper function to clean up expired events from the map
function cleanupExpiredEvents() {
  const now = new Date()
  let cleanedCount = 0

  console.log(`🧹 Starting cleanup at ${now.toISOString()}`)

  for (const [eventId, eventData] of eventMessageMap.entries()) {
    if (eventData.date) {
      const eventDate = new Date(eventData.date)
      const timeSinceEvent = now - eventDate
      const hoursSinceEvent = timeSinceEvent / (1000 * 60 * 60)

      console.log(
        `Event ${eventId}: ended ${hoursSinceEvent.toFixed(2)} hours ago (${eventDate.toISOString()})`,
      )

      // Remove events as soon as they've ended
      if (timeSinceEvent > 0) {
        console.log(`  → Cleaning up event ${eventId}`)
        // Clear interval if exists
        if (eventIntervals.has(eventId)) {
          clearInterval(eventIntervals.get(eventId))
          eventIntervals.delete(eventId)
        }
        eventMessageMap.delete(eventId)
        cleanedCount++
      }
    }
  }

  if (cleanedCount > 0) {
    saveEventMessageMap()
    console.log(`✅ Cleaned up ${cleanedCount} expired event(s)`)
  } else {
    console.log(`✅ No expired events to clean up`)
  }
}

// Middleware to verify webhook token
function verifyWebhookToken(req, res, next) {
  const token = req.headers['authorization']

  if (!token) {
    return res.status(401).send({ error: 'Missing authorization token' })
  }

  // Support both "Bearer TOKEN" and "TOKEN" formats
  const providedToken = token.startsWith('Bearer ') ? token.slice(7) : token

  if (providedToken !== WEBHOOK_AUTH_TOKEN) {
    return res.status(403).send({ error: 'Invalid authorization token' })
  }

  next()
}

function startServer(client) {
  const app = express()
  app.use(express.json())

  // Load existing event message mappings on startup
  loadEventMessageMap()

  // Clean up expired events on startup
  cleanupExpiredEvents()

  // Run cleanup every 12 hours
  setInterval(cleanupExpiredEvents, 12 * 60 * 60 * 1000)

  // Restore intervals for active events
  for (const [eventId, eventData] of eventMessageMap.entries()) {
    if (eventData.date) {
      setupEventInterval(client, eventId)
    }
  }

  // Route pour les news générales du site
  app.post('/webhook/website_news', verifyWebhookToken, async (req, res) => {
    try {
      const { content } = req.body

      if (!content) {
        console.log('Webhook received but no message content found.')
        return res.status(400).send({ error: 'Content of message is missing' })
      }

      const channel = await client.channels.fetch(WEBSITE_CHANNEL_ID)
      if (channel) {
        await channel.send(content)
        res.status(200).send({ success: 'Message sent to Discord' })
      } else {
        console.error(`Could not find channel with ID ${WEBSITE_CHANNEL_ID}`)
        res.status(404).send({ error: 'Discord channel not found' })
      }
    } catch (error) {
      console.error('Error processing webhook:', error)
      res.status(500).send({ error: 'Internal server error' })
    }
  })

  // ROUTES EVENTS

  // Route pour créer un événement
  app.post('/webhook/events/create', verifyWebhookToken, async (req, res) => {
    try {
      const { entry } = req.body

      if (!entry || !entry.id || !entry.title || !entry.startsAt) {
        console.log('Webhook received but missing required event data.')
        return res.status(400).send({
          error: 'Missing required event data (id, title, startsAt)',
        })
      }

      // Check if event already exists
      if (eventMessageMap.has(entry.id)) {
        console.log(`Event ${entry.id} already exists`)
        return res.status(409).send({
          error: 'Event already exists',
          eventId: entry.id,
          messageId: eventMessageMap.get(entry.id).messageId,
        })
      }

      const channel = await client.channels.fetch(EVENTS_CHANNEL_ID)
      if (!channel) {
        console.error(`Could not find channel with ID ${EVENTS_CHANNEL_ID}`)
        return res.status(404).send({ error: 'Discord channel not found' })
      }

      const eventUrl = `${process.env.EVENTS}/${entry.id}`
      const date = new Date(entry.startsAt)
      const readableDate = formatFrenchDate(date)

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

      // Store the message mapping with event data
      const eventData = {
        messageId: message.id,
        channelId: channel.id,
        date: date.toISOString(),
        readableDate: readableDate,
        embed: embed.toJSON(),
      }

      eventMessageMap.set(entry.id, eventData)
      saveEventMessageMap()

      // Set up the interval using the helper function
      await setupEventInterval(client, entry.id)

      console.log(
        `✅ Event "${entry.title}" posted successfully (ID: ${entry.id})`,
      )
      res.status(200).send({
        success: 'Event posted to Discord',
        messageId: message.id,
        eventId: entry.id,
        channelId: channel.id,
      })
    } catch (error) {
      console.error('Error processing event webhook:', error)
      res
        .status(500)
        .send({ error: 'Internal server error', details: error.message })
    }
  })

  // Route pour éditer un événement existant
  app.patch('/webhook/events/edit', verifyWebhookToken, async (req, res) => {
    try {
      const { eventId, updates } = req.body

      if (!eventId) {
        return res.status(400).send({ error: 'Missing eventId' })
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).send({ error: 'Missing updates object' })
      }

      const eventData = eventMessageMap.get(eventId)
      if (!eventData) {
        console.error(`Event with ID ${eventId} not found in active messages`)
        return res.status(404).send({
          error:
            'Event message not found. The event may not exist or the bot may have restarted.',
        })
      }

      const channel = await client.channels.fetch(eventData.channelId)
      if (!channel) {
        return res.status(404).send({ error: 'Discord channel not found' })
      }

      const message = await channel.messages.fetch(eventData.messageId)
      if (!message) {
        return res.status(404).send({ error: 'Discord message not found' })
      }

      // Get current embed
      const currentEmbed = message.embeds[0]
      let newEmbed = EmbedBuilder.from(currentEmbed)

      // Apply updates
      if (updates.title !== undefined) newEmbed.setTitle(updates.title)
      if (updates.description !== undefined)
        newEmbed.setDescription(updates.description)
      if (updates.color !== undefined) newEmbed.setColor(updates.color)
      if (updates.image !== undefined) newEmbed.setImage(updates.image)

      // Handle URL update
      let eventUrl = currentEmbed.url
      if (updates.id !== undefined) {
        eventUrl = `${process.env.EVENTS}/${updates.id}`
        newEmbed.setURL(eventUrl)
      }

      // If startsAt is updated, recalculate the date fields
      let date = new Date(eventData.date)
      let readableDate = eventData.readableDate

      if (updates.startsAt !== undefined) {
        date = new Date(updates.startsAt)
        readableDate = formatFrenchDate(date)

        // Update stored data
        eventData.date = date.toISOString()
        eventData.readableDate = readableDate
      }

      // Update fields with time remaining
      const timeRemaining = getTimeRemaining(date)
      newEmbed.setFields(
        { name: '\u200B', value: `:calendar_spiral: ${readableDate}` },
        { name: '\u200B', value: `:hourglass: ${timeRemaining}` },
      )

      // Update the message
      await message.edit({ embeds: [newEmbed] })

      // Update stored embed
      eventData.embed = newEmbed.toJSON()
      saveEventMessageMap()

      // Restart the interval with updated data
      await setupEventInterval(client, eventId)

      console.log(`✅ Event "${eventId}" updated successfully`)
      res.status(200).send({
        success: 'Event updated on Discord',
        eventId: eventId,
        messageId: eventData.messageId,
      })
    } catch (error) {
      console.error('Error editing event webhook:', error)
      res
        .status(500)
        .send({ error: 'Internal server error', details: error.message })
    }
  })

  // Route pour supprimer un événement
  app.delete('/webhook/events/delete', verifyWebhookToken, async (req, res) => {
    try {
      const { eventId } = req.body

      if (!eventId) {
        return res.status(400).send({ error: 'Missing eventId' })
      }

      const eventData = eventMessageMap.get(eventId)
      if (!eventData) {
        console.error(`Event with ID ${eventId} not found in active messages`)
        return res.status(404).send({
          error:
            'Event message not found. The event may not exist or may have already been deleted.',
        })
      }

      // Clear the interval if exists
      if (eventIntervals.has(eventId)) {
        clearInterval(eventIntervals.get(eventId))
        eventIntervals.delete(eventId)
      }

      // Delete the Discord message
      try {
        const channel = await client.channels.fetch(eventData.channelId)
        if (channel) {
          const message = await channel.messages.fetch(eventData.messageId)
          if (message) {
            await message.delete()
          }
        }
      } catch (error) {
        console.error(`Could not delete Discord message: ${error.message}`)
        // Continue anyway to clean up our data
      }

      // Remove from map and save
      eventMessageMap.delete(eventId)
      saveEventMessageMap()

      console.log(`✅ Event "${eventId}" deleted successfully`)
      res.status(200).send({
        success: 'Event deleted from Discord',
        eventId: eventId,
      })
    } catch (error) {
      console.error('Error deleting event webhook:', error)
      res
        .status(500)
        .send({ error: 'Internal server error', details: error.message })
    }
  })

  app.listen(WEBHOOK_PORT, () => {
    console.log(`Webhook server listening on port ${WEBHOOK_PORT}`)
  })
}

module.exports = { startServer }
