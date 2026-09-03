const express = require('express')

const RAIDLOGS_CHANNEL_ID = process.env.RAIDLOGS_CHANNEL_ID

function createRaidLogsRoutes(client, verifyWebhookToken) {
  const router = express.Router()

  // Route pour poster les logs de raid
  router.post('/raidlogs_post', verifyWebhookToken, async (req, res) => {
    try {
      const { raidlogs_url } = req.body

      if (!raidlogs_url) {
        console.log('Webhook received but no message content found.')
        return res.status(400).send({ error: 'Content of message is missing' })
      }

      const channel = await client.channels.fetch(RAIDLOGS_CHANNEL_ID)
      if (channel) {
        await channel.send(raidlogs_url)
        res.status(200).send({ success: 'Message sent to Discord' })
      } else {
        console.error(`Could not find channel with ID ${RAIDLOGS_CHANNEL_ID}`)
        res.status(404).send({ error: 'Discord channel not found' })
      }
    } catch (error) {
      console.error('Error processing webhook:', error)
      res.status(500).send({ error: 'Internal server error' })
    }
  })

  return router
}

module.exports = createRaidLogsRoutes
