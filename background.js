
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  switch (request?.type) {
    case 'login': {
      const redirectURL = chrome.identity.getRedirectURL()
      const { oauth2 } = chrome.runtime.getManifest()
      const clientId = oauth2.client_id
      const authParams = new URLSearchParams({
        client_id: clientId,
        response_type: 'token',
        redirect_uri: redirectURL,
        scope: oauth2.scopes.join(' '),
      })
      const authURL = `https://accounts.google.com/o/oauth2/auth?${authParams.toString()}`
      chrome.identity.launchWebAuthFlow({ url: authURL, interactive: true }).then((responseUrl) => {
        const url = new URL(responseUrl)
        const urlParams = new URLSearchParams(url.hash.slice(1))
        const params = Object.fromEntries(urlParams.entries())
        fetch(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${params.access_token}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).then(response => response.json()).then((data) => {
          chrome.storage.local.set({ user: { ...data, ...params } }).then(() => {
            sendResponse({ ...data, ...params })
          })
        })

      }).catch((error) => {
        return sendResponse(null)
      })
    }
  }
  return true
})
