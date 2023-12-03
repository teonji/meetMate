const getUser = async () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['user']).then((result) => {
      resolve(result.user)
    })
  })
}
const setUser = async (data) => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ user: data }).then(() => {
      user = data
      resolve(data)
    })
  })
}
const login = () => {
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
      setUser({ ...data, ...params }).then(() => {
        setUserData({ ...data, ...params })
      })
    })
  }).catch((error) => {
    console.warn(error.message, authURL)
  })
}
const logout = () => {
  setUser(null)
  const loginBtn = document.getElementById('loginBtn')
  const userBtn = document.getElementById('user')
  loginBtn.style.display = 'block'
  userBtn.style.display = 'none'
}

const setUserData = (user) => {
  const loginBtn = document.getElementById('loginBtn')
  const userBtn = document.getElementById('user')
  loginBtn.style.display = 'none'
  userBtn.style.display = 'flex'
  const userPic = document.getElementById('userPic')
  const userEmail = document.getElementById('userEmail')
  userPic.src = user.picture
  userEmail.innerText = user.email
}

document.addEventListener("DOMContentLoaded", async () => {
  let user = await getUser()
  const loginBtn = document.getElementById('loginBtn')
  const userBtn = document.getElementById('user')
  const logoutBtn = document.getElementById('logout')
  loginBtn.addEventListener("click", login)
  logoutBtn.addEventListener("click", logout)
  if (user) {
    setUserData(user)
  }
})
