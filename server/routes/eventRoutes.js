const express = require('express')
const { EmbedBuilder } = require('discord.js')

const EVENTS_CHANNEL_ID = process.env.EVENTS_CHANNEL_ID_TEST

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
async function setupEventInterval(
  client,
  eventId,
  eventMessageMap,
  eventIntervals,
  saveEventMessageMap,
) {
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

function createEventRoutes(
  client,
  eventMessageMap,
  eventIntervals,
  saveEventMessageMap,
  verifyWebhookToken,
) {
  const router = express.Router()

  // Route pour créer un événement
  router.post('/create', verifyWebhookToken, async (req, res) => {
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
      await setupEventInterval(
        client,
        entry.id,
        eventMessageMap,
        eventIntervals,
        saveEventMessageMap,
      )

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
  router.patch('/edit', verifyWebhookToken, async (req, res) => {
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
      await setupEventInterval(
        client,
        eventId,
        eventMessageMap,
        eventIntervals,
        saveEventMessageMap,
      )

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
  router.delete('/delete', verifyWebhookToken, async (req, res) => {
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

  return router
}

module.exports = { createEventRoutes, setupEventInterval }
