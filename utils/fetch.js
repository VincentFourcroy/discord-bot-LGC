const fetch = require('node-fetch')

async function fetchAllPages(baseUrl) {
  let allData = []
  let page = 1
  const limit = 10

  while (true) {
    const url = `${baseUrl}?page=${page}&limit=${limit}`
    try {
      const response = await fetch(url)
      if (!response.ok) {
        const errorBody = await response.text()
        console.error(
          `Failed to fetch JSON data from ${url}. Status: ${response.status}, Body: ${errorBody}`,
        )
        break
      }
      const jsonResponse = await response.json()
      if (!jsonResponse.items || jsonResponse.items.length === 0) {
        console.log('No more items to fetch. Stopping pagination.')
        break
      }
      allData = allData.concat(jsonResponse.items)
      if (!jsonResponse.links || !jsonResponse.links.next) {
        console.log('No next link found. Stopping pagination.')
        break
      }
      page++
    } catch (error) {
      console.error(`Error fetching page ${page} from ${baseUrl}:`, error)
      break
    }
  }
  return allData
}

module.exports = { fetchAllPages }
