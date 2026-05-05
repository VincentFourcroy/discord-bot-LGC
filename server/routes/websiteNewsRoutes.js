const express = require('express')

const WEBSITE_CHANNEL_ID = process.env.WEBSITE_CHANNEL_ID

function createNewsRoutes(client, verifyWebhookToken) {
  const router = express.Router()

  // Route pour les news générales du site
  router.post('/website_news', verifyWebhookToken, async (req, res) => {
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

  return router
}

module.exports = createNewsRoutes
