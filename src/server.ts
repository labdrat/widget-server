import express from 'express'
import fs from 'node:fs'
import pg from 'pg'

// set up express web server
const app = express()

// set up static content
app.use(express.static('public'))

// postgres client
const postgres = {
  interval: null as NodeJS.Timeout | null,

  reconnect() {
    if (this.interval) return

    this.interval = setInterval(() => {
      this.tryConnect().catch(console.log)
    }, 1000)
  },

  async tryConnect(reconnect = false) {
    if (this.client || !this.connect || !this.disconnect) return

    try {
      await this.connect()

      if (this.interval) {
        clearInterval(this.interval)
        this.interval = null
      }
    } catch (error) {
      console.error(error)
      this.disconnect()
      if (reconnect) this.reconnect()
      throw error
    }
  },
  client: null as pg.Client | null,

  async connect() {
    this.client = new pg.Client({ connectionString: process.env.DATABASE_URL })

    await this.client.connect()

    this.client.on('end', () => {
      this.disconnect()
      this.reconnect()
    })
  },

  disconnect() {
    if (this.client) {
      this.client.end()
      this.client = null
    }
  }
}

// last known count
let count = 0

// Main page
app.get('/', async(_request, response) => {
  if (postgres.client) {
    // fetch current count
    const welcome = await postgres.client.query('SELECT "count" from "welcome"')

    // increment count, creating table row if necessary
    if (!welcome.rows.length) {
      count = 1
      await postgres.client?.query('INSERT INTO "welcome" VALUES($1)', [count])
    } else {
      count = welcome.rows[0].count + 1
      await postgres.client?.query('UPDATE "welcome" SET "count" = $1', [count])
    }
  }

  // render HTML response
  try {
    const content = fs.readFileSync('views/index.tmpl', 'utf-8')
      .replace('@@COUNT@@', count.toString())
    response.set('Content-Type', 'text/html')
    response.send(content)
  } catch (error) {
    response.send()
  }
})


;(async() => {
  // try to connect to postgres
  // await postgres.tryConnect(true)

  
  // Ensure welcome table exists
  // await postgres.client?.query('CREATE TABLE IF NOT EXISTS "welcome" ( "count" INTEGER )')

  // Start web server on port 3000
  app.listen(3000, () => {
    console.log('Server is listening on port 3000')
  })
})()
