const express = require('express')

const GUILD_ID = process.env.GUILD_ID

function createMiscInfoRoutes(client, verifyWebhookToken) {
  const router = express.Router()

  // Route pour poster des messages dans un canal spécifique (ID fourni dans le body)
  router.post('/misc_info', verifyWebhookToken, async (req, res) => {
    try {
      const { content, channel_id } = req.body

      if (!content) {
        console.log('Webhook received but no message content found.')
        return res.status(400).send({ error: 'Content of message is missing' })
      }

      if (!channel_id) {
        console.log('Webhook received but no channel_id found.')
        return res.status(400).send({ error: 'channel_id is missing' })
      }

      const channel = await client.channels.fetch(channel_id)
      if (channel) {
        // Vérifier que le canal appartient au bon serveur Discord
        if (channel.guildId !== GUILD_ID) {
          console.error(
            `Channel ${channel_id} belongs to guild ${channel.guildId}, expected ${GUILD_ID}`,
          )
          return res.status(403).send({
            error: 'Channel does not belong to the authorized guild',
          })
        }

        await channel.send(content)
        res.status(200).send({
          success: 'Message sent to Discord',
          channelId: channel_id,
        })
      } else {
        console.error(`Could not find channel with ID ${channel_id}`)
        res.status(404).send({ error: 'Discord channel not found' })
      }
    } catch (error) {
      console.error('Error processing webhook:', error)
      res
        .status(500)
        .send({ error: 'Internal server error', details: error.message })
    }
  })

  return router
}

module.exports = createMiscInfoRoutes
