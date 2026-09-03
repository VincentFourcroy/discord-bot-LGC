const express = require('express')
const multer = require('multer')

const GUILD_ID = process.env.GUILD_ID

const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/x-wav',
  'audio/mp4',
  'audio/webm',
  'audio/flac',
]

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max (limite Discord sans Nitro)
  fileFilter: (_req, file, cb) => {
    const isValidAudio =
      file.fieldname === 'audio' &&
      ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)
    const isValidImage =
      file.fieldname === 'image' &&
      ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)

    if (isValidAudio || isValidImage) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type for the given field'))
    }
  },
})

function createMiscInfoRoutes(client, verifyWebhookToken) {
  const router = express.Router()

  // Route pour poster du texte et/ou un audio et/ou une image dans un canal spécifique
  router.post(
    '/misc_info',
    verifyWebhookToken,
    upload.fields([
      { name: 'audio', maxCount: 10 },
      { name: 'image', maxCount: 10 },
    ]),
    async (req, res) => {
      try {
        const { content, channel_id } = req.body
        const audioFiles = req.files?.audio || []
        const imageFiles = req.files?.image || []

        if (!content && audioFiles.length === 0 && imageFiles.length === 0) {
          console.log('Webhook received but no content, audio or image found.')
          return res.status(400).send({
            error: 'At least one of content, audio or image must be provided',
          })
        }

        if (audioFiles.length + imageFiles.length > 10) {
          return res.status(400).send({
            error: 'Maximum 10 files total (audio + image) allowed',
          })
        }

        if (!channel_id) {
          console.log('Webhook received but no channel_id found.')
          return res.status(400).send({ error: 'channel_id is missing' })
        }

        const channel = await client.channels.fetch(channel_id)
        if (!channel) {
          console.error(`Could not find channel with ID ${channel_id}`)
          return res.status(404).send({ error: 'Discord channel not found' })
        }

        // Vérifier que le canal appartient au bon serveur Discord
        if (channel.guildId !== GUILD_ID) {
          console.error(`Channel ${channel_id} belongs to the wrong guild.`)
          return res.status(403).send({
            error: 'Channel does not belong to the authorized guild',
          })
        }

        const files = [...audioFiles, ...imageFiles].map((file) => ({
          attachment: file.buffer,
          name: file.originalname,
        }))

        const payload = {}
        if (content) payload.content = content.replace(/\\n/g, '\n')
        if (files.length) payload.files = files

        await channel.send(payload)

        res.status(200).send({
          success: 'Message sent to Discord',
          channelId: channel_id,
        })
      } catch (error) {
        console.error('Error processing webhook:', error)
        res
          .status(500)
          .send({ error: 'Internal server error', details: error.message })
      }
    },
  )

  return router
}

module.exports = createMiscInfoRoutes
