const { Events } = require('discord.js')
const { checkForEventsUpdates } = require('../tasks/eventChecker')
const { checkForNewsUpdates } = require('../tasks/newsChecker')
const { startServer } = require('../server/webhookServer')
const { initializeScheduler } = require('../tasks/scheduler')

const CHECK_INTERVAL = 10 * 60 * 1000

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`)

    // Démarrer les modules externes
    startServer(client)
    initializeScheduler(client)

    // Tâches de vérification initiales et périodiques
    checkForEventsUpdates(client)
    checkForNewsUpdates(client)
    setInterval(() => checkForEventsUpdates(client), CHECK_INTERVAL)
    setInterval(() => checkForNewsUpdates(client), CHECK_INTERVAL)
  },
}
