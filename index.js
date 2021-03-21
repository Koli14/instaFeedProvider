const express = require('express')
const fetch = require('node-fetch')
const cors = require('cors')
const NodeCache = require('node-cache')
const norobot = require('norobot')

require('dotenv').config()

const app = express()

app.use(cors())
app.use(norobot(true))

class HTTPResponseError extends Error {
  constructor (response, ...args) {
    super(`HTTP Error Response: ${response.status} ${response.statusText}`, ...args)
    this.response = response
  }
}

const checkStatus = response => {
  if (response.ok) {
    // response.status >= 200 && response.status < 300
    return response
  } else {
    throw new HTTPResponseError(response)
  }
}
const ttl = 60 * 15 // 15 minutes
const myCache = new NodeCache({ stdTTL: ttl, checkperiod: ttl * 0.2 })

const instaAccessToken = process.env.INSTA_ACCES_TOKEN
const instaId = process.env.INSTA_USER_ID
const limit = 8 // Limit of the insta media (insta default is 25)
// See the list of possible fields here: https://developers.facebook.com/docs/instagram-basic-display-api/reference/media#fields
const fields = 'id,caption,media_url,permalink'
const baseUrl = `https://graph.instagram.com/v6.0/${instaId}/media?fields=${fields}&limit=${limit}&access_token=${instaAccessToken}`

// You will find your insta feed here:
app.get('/insta', norobot, async (req, res) => {
  let cachedData = myCache.get('instaResponse')
  if (cachedData === undefined) {
    try {
      const response = await fetch(baseUrl)
      checkStatus(response)
      const data = await response.json()
      cachedData = data
      const success = myCache.set('instaResponse', data, ttl)
      const date = new Date()
      console.log('Cache generated: ' + success + ' At: ' + date.toLocaleString('hu-HU', { hour12: false }))
    } catch (error) {
      console.log(error)
    }
  }
  res.send(cachedData)
})

// Use a free Cron Job service (e.g.: https://cron-job.org), and call this endpoint weekly, as Long-Lived Tokens are valid for only 60 days
// With this calling this endpoint, your token will be refreshed to 60 days
// More info: https://developers.facebook.com/docs/instagram-basic-display-api/guides/long-lived-access-tokens#get-a-long-lived-token
app.get('/refresh', norobot, async (req, res) => {
  const url = 'https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token='
  try {
    const response = await fetch(url + instaAccessToken)
    const data = await response.json()
    console.log(data)
    res.send('Trying to refresh instaToken DONE.')
  } catch (error) {
    console.log('There was an error while trying to refresh instaToken')
  }
})

app.get('/robots.txt', function (req, res) {
  res.type('text/plain')
  res.send('User-agent: *\nDisallow: /')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`App listening on PORT ${PORT}!`)
})
