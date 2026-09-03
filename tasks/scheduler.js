const schedule = require('node-schedule')
const fetch = require('node-fetch')
const fs = require('node:fs')
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

const JOBS_STATE_PATH = './data/scheduler_state.json'

const jobsEnabled = {
  raidReminder: true,
  raidReroll: true,
  dailyMeme: true,
}

function loadJobsState() {
  try {
    if (fs.existsSync(JOBS_STATE_PATH)) {
      const data = JSON.parse(fs.readFileSync(JOBS_STATE_PATH, 'utf-8'))
      for (const key of Object.keys(jobsEnabled)) {
        if (typeof data[key] === 'boolean') jobsEnabled[key] = data[key]
      }
      console.log('✅ Scheduler state loaded:', jobsEnabled)
    }
  } catch (error) {
    console.error('❌ Error loading scheduler state:', error)
  }
}

function saveJobsState() {
  try {
    fs.writeFileSync(JOBS_STATE_PATH, JSON.stringify(jobsEnabled, null, 2))
  } catch (error) {
    console.error('❌ Error saving scheduler state:', error)
  }
}

function setJobEnabled(jobName, enabled) {
  if (!(jobName in jobsEnabled)) return false
  jobsEnabled[jobName] = enabled
  saveJobsState()
  console.log(`Scheduler job "${jobName}" ${enabled ? 'activé' : 'désactivé'}`)
  return true
}

function initializeScheduler(client) {
  loadJobsState()

  // Tâche planifiée pour les rappels de raid
  schedule.scheduleJob(
    'raidReminder',
    { hour: 10, minute: 0, dayOfWeek: [1, 4], tz: 'Europe/Paris' },
    async () => {
      if (!jobsEnabled.raidReminder) return

      const reminderChannel = await client.channels.fetch(REMINDER_CHANNEL_ID)

      const messages = [
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nSalut tout le monde ! Le calendrier pour nos prochains raids est ouvert. N'oubliez pas de confirmer votre présence, on a besoin de tous les héros d'Azeroth pour espérer tomber les boss cette semaine !`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nC'est l'heure de la pause café ! Et de l'inscription au raid de ce soir ! :coffee:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nPetit rappel pour les inscriptions aux raids. Azeroth a besoin de vous, et nous aussi ! Un clic sur le calendrier et on est parés pour l'aventure.`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nRaid en approche ! N'oubliez pas de vous inscrire sur le site. Même les plus grands champions ont besoin d'une bonne équipe, alors on compte sur votre présence.`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nLe Grand Conseil a besoin de vous ! Inscrivez-vous au raid de ce soir ! :index_pointing_at_the_viewer:`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nSi vous prévoyez de venir aider à purger Azeroth de ses menaces, pensez à vous inscrire sur le calendrier. On évite le rush de dernière minute, c'est mieux pour tout le monde !`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nOn ne va pas down le prochain boss avec la puissance de l'amitié et vos excuses en carton. Allez, inscrivez-vous au raid de ce soir, à moins que vous ne préfériez loot que du gris ?!`,
        `<@&${CONSEILLER_ROLE_ID}> <@&${MEMBRE_ROLE_ID}>\nArthas a fini par se lever de son trône gelé, vous devriez réussir à bouger vos doigts jusqu'au calendrier pour vous inscrire au raid de ce soir ! On n'attend plus que vous !`,
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
    'raidReroll',
    { hour: 10, minute: 0, dayOfWeek: [6], tz: 'Europe/Paris' },
    async () => {
      if (!jobsEnabled.raidReroll) return

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
    'dailyMeme',
    { hour: 13, minute: 0, tz: 'Europe/Paris' },
    async () => {
      if (!jobsEnabled.dailyMeme) return

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

module.exports = { initializeScheduler, setJobEnabled, jobsEnabled }
