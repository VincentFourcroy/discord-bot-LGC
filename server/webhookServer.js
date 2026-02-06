const express = require('express')

const WEBSITE_CHANNEL_ID = process.env.WEBSITE_CHANNEL_ID
const EVENTS_CHANNEL_ID = process.env.EVENTS_CHANNEL_ID
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID
const WEBHOOK_PORT = process.env.WEBHOOK_PORT

function startServer(client) {
  const app = express()
  app.use(express.json()) // Middleware to parse JSON bodies

  // Route pour les news générales du site
  app.post('/webhook/website_news', async (req, res) => {
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

  // Route pour poster sur des canaux spécifiques
  app.post('/webhook/post_to', async (req, res) => {
    try {
      const { channel_name, content } = req.body

      if (!content) {
        console.log('Webhook received but no message content found.')
        return res.status(400).send({ error: 'Content of message is missing' })
      }

      let channelId
      if (channel_name === 'raid') {
        channelId = EVENTS_CHANNEL_ID
      } else if (channel_name === 'mm') {
        channelId = NEWS_CHANNEL_ID
      } else {
        console.error(`Invalid channel_name provided: ${channel_name}`)
        return res.status(400).send({ error: 'Invalid channel name specified' })
      }

      const channel = await client.channels.fetch(channelId)
      if (channel) {
        await channel.send(content)
        res.status(200).send({ success: 'Message sent to Discord' })
      } else {
        console.error(`Could not find channel with ID ${channelId}`)
        res.status(404).send({ error: 'Discord channel not found' })
      }
    } catch (error) {
      console.error('Error processing webhook:', error)
      res.status(500).send({ error: 'Internal server error' })
    }
  })

  app.listen(WEBHOOK_PORT, () => {
    console.log(`Webhook server listening on port ${WEBHOOK_PORT}`)
  })
}

module.exports = { startServer }
