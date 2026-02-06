const schedule = require('node-schedule')
const fetch = require('node-fetch')
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js')

const REMINDER_CHANNEL_ID = process.env.REMINDER_CHANNEL_ID
const CONSEILLER_ROLE_ID = process.env.CONSEILLER_ROLE_ID
const MEMBRE_ROLE_ID = process.env.MEMBRE_ROLE_ID
const IMAGE_API_URL = process.env.IMAGE_API_URL
const IMAGE_CHANNEL_ID = process.env.IMAGE_CHANNEL_ID
const MEME_URL = process.env.MEME_URL
const galleryUrl = process.env.IMAGE_LIKE_URL

function initializeScheduler(client) {
  // Tâche planifiée pour les rappels de raid
  schedule.scheduleJob(
    { hour: 10, minute: 0, dayOfWeek: [1, 4], tz: 'Europe/Paris' },
    async () => {
      const reminderChannel = await client.channels.fetch(REMINDER_CHANNEL_ID)

      const messages = [
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nPour votre santé, mangez 5 Fruits & Légumes par jour. Et inscrivez-vous au raid de ce soir ! :apple:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nC'est l'heure de la pause café ! Et de l'inscription au raid de ce soir ! :coffee:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nMicheeeeeeeeeel, c'est le rappel-euh ! Pour vouuuuuuus inscrire en raid ! :partying_face:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nLa démocratie n'attend pas. Rejoignez les HellGC, inscrivez-vous au raid de ce soir ! :military_helmet:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nLe Grand Conseil a besoin de vous ! Inscrivez-vous au raid de ce soir ! :index_pointing_at_the_viewer:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nQuelle heure est-il ? Celle d'une partie de Civ ? Celle d'un p'tit Kallax ? Non ! Celle du rappel de l'inscription au raid du soir ! :grin:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nPromotion au rayon Calendrier ! Pour une inscription au raid de ce soir réalisée, obtenez une photo des pieds de Xal'atath ! :scream:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nTu vois, le monde se divise en deux catégories... Ceux qui ne viennent pas en raid... Et ceux qui s'inscrivent... Toi, tu t'inscris. :cowboy:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nVous savez, moi je ne crois pas qu'il y ait de bonne ou de mauvaise situation. Moi, si je devais résumer ma vie aujourd'hui avec vous, je dirais que c'est d'abord des inscriptions au raid du soir. :thinking:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nSi vous n'êtes pas inscrits au raid de ce soir, nous ne serons pas en colère... Nous serons juste déçus.`,
      ]

      for (let i = messages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[messages[i], messages[j]] = [messages[j], messages[i]]
      }

      const randomIndex = Math.floor(Math.random() * messages.length)
      const randomMessage = messages[randomIndex]
      await reminderChannel.send(randomMessage)
    },
  )

  // Tâche planifiée pour les rappels de raid reroll
  schedule.scheduleJob(
    { hour: 10, minute: 0, dayOfWeek: [6], tz: 'Europe/Paris' },
    async () => {
      const reminderChannel = await client.channels.fetch(REMINDER_CHANNEL_ID)

      const messages = [
        `Ce soir, c'est raid reroll ou vaisselle. À toi de choisir, mais le raid est plus fun ! :bowl_with_spoon:`,
        `Inscris-toi au raid reroll de ce soir, sinon je vais encore faire des blagues... et personne ne veut ça. :clown_face:`,
        `Ce soir, le Grand Conseil t'attend au raid reroll. Si tu ne viens pas, on enverra des gifs gênants. :see_no_evil:`,
        `Le raid reroll de ce soir, c'est comme le café : indispensable pour bien finir la journée ! :coffee:`,
        `On a des cookies... mais seulement pour ceux qui s'inscrivent au raid reroll de ce soir. :cookie:`,
        `Inscris-toi au raid reroll de ce soir, sinon on te mettra dans mon équipe. Courage. :sweat_smile:`,
        `Ce soir, c'est raid reroll. Si tu ne viens pas, on te laisse le loot... mais seulement en photo. :camera_flash:`,
        `Un raid reroll sans toi, c'est comme une pizza sans fromage. Possible, mais franchement moins bon. :pizza:`,
        `Ce soir, c'est raid reroll. Si tu viens, tu gagnes des points karma. Si tu ne viens pas, tu gagnes… des regards déçus. :disappointed:`,
      ]

      for (let i = messages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[messages[i], messages[j]] = [messages[j], messages[i]]
      }

      const randomIndex = Math.floor(Math.random() * messages.length)
      const randomMessage = messages[randomIndex]
      await reminderChannel.send(randomMessage)
    },
  )

  // Tâche planifiée pour poster un meme aléatoire depuis la galerie
  schedule.scheduleJob(
    { hour: 13, minute: 0, tz: 'Europe/Paris' },
    async () => {
      try {
        const imageChannel = await client.channels.fetch(IMAGE_CHANNEL_ID)

        // Appel à l'API pour récupérer l'URL de l'image
        const response = await fetch(IMAGE_API_URL)

        if (!response.ok) {
          console.error(
            `Failed to fetch image from API. Status: ${response.status}`,
          )
          return
        }

        const data = await response.json()

        // Récupération de l'URL depuis asset.filenameUrl et de l'ID
        const imageUrl = data?.asset?.filenameUrl
        const memeId = data?.id

        if (!imageUrl) {
          console.error(
            'No image URL found at asset.filenameUrl in API response',
          )
          return
        }

        if (!memeId) {
          console.error('No ID found in API response')
          return
        }

        // Construire l'URL de vote avec l'ID
        const memeUrl = `${MEME_URL}${memeId}`

        // Créer l'embed
        const embed = new EmbedBuilder()
          .setColor(0xff6b35)
          .setTitle('🔀 Le meme du jour !')
          .setURL(memeUrl)
          .setAuthor({ name: 'Le Grand Conseil', url: process.env.WEBSITE })
          .setDescription(
            'Parce que le rire est la plus efficace des médecines.',
          )
          .setImage(imageUrl)
          .setFooter({ text: 'Présenté par LGC' })
          .setTimestamp()

        // Créer le bouton de vote
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Visitez la galerie et likez vos posts préférés !')
            .setURL(galleryUrl)
            .setStyle(ButtonStyle.Link)
            .setEmoji('❤️'),
        )

        // Envoyer l'embed avec le bouton
        await imageChannel.send({
          embeds: [embed],
          components: [row],
        })

        console.log('Image posted successfully')
      } catch (error) {
        console.error('Error fetching or posting image:', error)
      }
    },
  )

  console.log('Scheduler initialized.')
}

module.exports = { initializeScheduler }
