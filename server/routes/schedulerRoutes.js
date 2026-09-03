const express = require('express')
const { setJobEnabled, jobsEnabled } = require('../../tasks/scheduler')

function createSchedulerRoutes(verifyWebhookToken) {
  const router = express.Router()

  const VALID_JOBS = ['raidReminder', 'raidReroll', 'dailyMeme']

  // POST /webhook/scheduler/toggle
  // Body: { "job": "raidReminder", "enabled": false }
  router.post('/toggle', verifyWebhookToken, (req, res) => {
    const { job, enabled } = req.body

    if (!job || typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Les champs "job" (string) et "enabled" (boolean) sont requis',
      })
    }

    if (!VALID_JOBS.includes(job)) {
      return res.status(404).json({
        error: `Job "${job}" introuvable. Jobs valides : ${VALID_JOBS.join(', ')}`,
      })
    }

    setJobEnabled(job, enabled)

    return res.json({
      job,
      enabled,
      message: `Job "${job}" ${enabled ? 'activé' : 'désactivé'} avec succès`,
    })
  })

  // GET /webhook/scheduler/status
  router.get('/status', verifyWebhookToken, (req, res) => {
    return res.json({ jobs: jobsEnabled })
  })

  return router
}

module.exports = createSchedulerRoutes
