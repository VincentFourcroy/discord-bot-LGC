const { Events } = require('discord.js')
const schedule = require('node-schedule')
const express = require('express')
const { checkForEventsUpdates } = require('../tasks/eventChecker')
const { checkForNewsUpdates } = require('../tasks/newsChecker')

const REMINDER_CHANNEL_ID = process.env.REMINDER_CHANNEL_ID
const CONSEILLER_ROLE_ID = process.env.CONSEILLER_ROLE_ID
const MEMBRE_ROLE_ID = process.env.MEMBRE_ROLE_ID
const WEBSITE_CHANNEL_ID = process.env.WEBSITE_CHANNEL_ID
const WEBHOOK_PORT = process.env.WEBHOOK_PORT
const CHECK_INTERVAL = 10 * 60 * 1000

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`)

    // Setup express server for webhook
    const app = express()
    app.use(express.json()) // Middleware to parse JSON bodies

    app.post('/webhook/website_news', async (req, res) => {
      try {
        // On suppose que le corps du ping contient une clé "content"
        const { content } = req.body

        if (!content) {
          console.log('Webhook received but no message content found.')
          return res
            .status(400)
            .send({ error: 'Content of message is missing' })
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

    app.listen(WEBHOOK_PORT, () => {})

    // Initial checks
    checkForEventsUpdates(client)
    checkForNewsUpdates(client)
    // Periodical checks
    setInterval(() => checkForEventsUpdates(client), CHECK_INTERVAL)
    setInterval(() => checkForNewsUpdates(client), CHECK_INTERVAL)

    schedule.scheduleJob(
      { hour: 10, minute: 0, dayOfWeek: [1, 4], tz: 'Europe/Paris' },
      async () => {
        const reminderChannel = await client.channels.fetch(REMINDER_CHANNEL_ID)

        // Array of predefined messages
        const messages = [
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nPour votre santé, mangez 5 Fruits & Légumes par jour. Et inscrivez-vous au raid de ce soir ! :apple:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nC'est l'heure de la pause café ! Et de l'inscription au raid de ce soir ! :coffee:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nMicheeeeeeeeeel, c'est le rappel-euh ! Pour vouuuuuuus inscrire en raid ! :partying_face:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nLa démocratie n'attend pas. Rejoignez les HellGC, inscrivez-vous au raid de ce soir ! :military_helmet:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nLe Grand Conseil a besoin de vous ! Inscrivez-vous au raid de ce soir ! :index_pointing_at_the_viewer:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nQuelle heure est-il ? Celle d'une partie de Civ ? Celle d'un p'tit Kallax ? Non ! Celle du rappel de l'inscription au raid du soir ! :grin:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nPromotion au rayon Calendrier ! Pour une inscription au raid de ce soir réalisée, obtenez une photo des pieds de Xal'atath ! :scream:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nTu vois, le monde se divise en deux catégories... Ceux qui ne viennent pas en raid... Et ceux qui s'inscrivent... Toi, tu t'inscris. :cowboy:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nVous savez, moi je ne crois pas qu'il y ait de bonne ou de mauvaise situation. Moi, si je devais résumer ma vie aujourd'hui avec vous, je dirais que c'est d'abord des inscriptions au raid du soir. :thinking:`,
          `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\\nSi vous n'êtes pas inscrits au raid de ce soir, nous ne serons pas en colère... Nous serons juste déçus.`,
        ]

        // Shuffle the array using the Fisher-Yates algorithm
        for (let i = messages.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[messages[i], messages[j]] = [messages[j], messages[i]]
        }

        // Pick a random message from the array
        const randomIndex = Math.floor(Math.random() * messages.length)
        const randomMessage = messages[randomIndex]

        // Send the random message
        await reminderChannel.send(randomMessage)
      },
    )
  },
}
