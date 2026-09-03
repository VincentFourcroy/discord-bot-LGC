const express = require('express')
const fs = require('node:fs')
const verifyWebhookToken = require('./middleware/verifyWebhookToken')
const {
  createEventRoutes,
  setupEventInterval,
} = require('./routes/eventRoutes')
const createNewsRoutes = require('./routes/websiteNewsRoutes')
const createMiscInfoRoutes = require('./routes/miscInfoRoutes')
const createSchedulerRoutes = require('./routes/schedulerRoutes')
const createRaidLogsRoutes = require('./routes/raidlogsPostRoutes')

const WEBHOOK_PORT = process.env.WEBHOOK_PORT
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
      setupEventInterval(
        client,
        eventId,
        eventMessageMap,
        eventIntervals,
        saveEventMessageMap,
      )
    }
  }

  // ROUTES NEWS - Utilisation du router modulaire
  const newsRoutes = createNewsRoutes(client, verifyWebhookToken)
  app.use('/webhook', newsRoutes)

  // ROUTES MISC INFO - Utilisation du router modulaire
  const miscInfoRoutes = createMiscInfoRoutes(client, verifyWebhookToken)
  app.use('/webhook', miscInfoRoutes)

  // ROUTES SCHEDULER - Activer/désactiver les jobs planifiés
  const schedulerRoutes = createSchedulerRoutes(verifyWebhookToken)
  app.use('/webhook/scheduler', schedulerRoutes)

  // ROUTES EVENTS - Utilisation du router modulaire
  const eventRoutes = createEventRoutes(
    client,
    eventMessageMap,
    eventIntervals,
    saveEventMessageMap,
    verifyWebhookToken,
  )
  app.use('/webhook/events', eventRoutes)

  // ROUTES RAIDLOGS - Poster les raidlogs
  const raidLogsRoutes = createRaidLogsRoutes(client, verifyWebhookToken)
  app.use('/webhook', raidLogsRoutes)

  app.listen(WEBHOOK_PORT, () => {
    console.log(`Webhook server listening on port ${WEBHOOK_PORT}`)
  })
}

module.exports = { startServer }
