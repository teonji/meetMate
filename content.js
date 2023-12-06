const addCss = rule => {
  let css = document.createElement('style')
  css.type = 'text/css'
  if (css.styleSheet) css.styleSheet.cssText = rule
  else css.appendChild(document.createTextNode(rule))
  document.getElementsByTagName("head")[0].appendChild(css)
}

addCss(`
#meeting-ext-button {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin: 0 10px 10px 10px;
}
.saved {
  background-color: var(--hotlane-custom-background-color);
  padding: 0.75rem;
  margin: -0.75rem;
  border-radius: 4px;
}
.saved:first-child {
  padding-top: 0.75rem!important;
}
.chat-wrapper {
    display: block;
    padding: 0.75rem 1.5rem 0.875rem;
}
.meeting-check {
  margin-right: 8px;
  width: 20px;
}
.chat-who {
    color: var(--hotlane-on-background-color);
    display: inline-block;
    float: left;
    font-size: .8125rem;
    font-weight: 500;
    line-height: 1.25;
    padding-bottom: 0.1875rem;
    padding-top: 0.25rem;
    padding-right: 0.5rem;
    word-wrap: break-word;
}
.chat-time {
    color: var(--hotlane-on-surface-variant-color);
    display: inline-block;
    float: left;
    font-size: .75rem;
    line-height: 1.5;
    padding-top: 0.1875rem;
}
.chat-message-wrapper {
    clear: both;
    max-width: 100%;
}
.chat-message {
    color: var(--hotlane-on-background-color);
    font-size: .8125rem;
    line-height: 1.25rem;
    padding-top: 0.625rem;
    white-space: pre-wrap;
    word-wrap: break-word;
}
.meeting-ext-buttons {
    width: 100%;
    border-radius: 4px;
    text-align: center;
    padding: 0.75rem;
}
.meeting-ext-buttons:hover {
    background-color: var(--hotlane-custom-background-color);
    cursor: pointer;
}
#timer {
  position: absolute;
  background-color: black;
  z-index: 99999;
  width: 200px;
  height: 30px;
  top: 10px;
  left: 50%;
  transform: translate(-50%, 0);
  border-radius: 10px;
}
#time {
  color: white;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  font-size: 18px;
}
#progress-content {
  display: none;
  position: absolute;
  bottom: 4px;
  height: 5px;
  width: 120px;
  background-color: #999;
  border-radius: 10px;
  left: 50%;
  transform: translate(-50%, 0);
}
#progress {
  width: 0;
  height: 5px;
  border-radius: 10px;
  background-color: #00ff00;
}

#active {
  position: absolute;
  background-color: #00ff00;
  width: 10px;
  height: 10px;
  top: 10px;
  left: 10px;
  border-radius: 50%;
  animation: blinker 1s linear infinite;
}
@keyframes blinker {
  50% {
    opacity: 0;
  }
}

#login {
  cursor: pointer;
  position: absolute;
  background-color: #ccc;
  width: 20px;
  height: 20px;
  top: 5px;
  right: 5px;
  border-radius: 50%;
}
#user-img {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
.not-started {
  background-color: #1A6DDD!important
}
.is-finished {
  background-color: #ff0000!important;
}
#others-info {
  position: absolute;
  background-color: black;
  z-index: 777;
  width: 300px;
  height: 40px;
  top: 34px;
  left: 50%;
  transform: translate(-50%, 0);
  border-radius: 10px;
  display: none;
  items-align: center;
  justify-content: space-around;
}
#start-content, #next-content {
  display: flex;
  color: white;
  flex-direction: column;
  margin: auto;
  text-align: center;
}
`)

let db
let request = indexedDB.open('meeting-stand-up', 1)

request.onerror = () => {
  console.error('Error launching db')
}

request.onsuccess = () => {
  db = request.result
}

request.onupgradeneeded = (event) => {
  db = event.target.result
  const checkUserStore = db.createObjectStore('checkUser', { keyPath: 'id' })
  checkUserStore.createIndex('id', 'id', { unique: true })

  const chatStore = db.createObjectStore('chat', { keyPath: 'id' })
  chatStore.createIndex('id', 'id', { unique: true })
}

const login = async () => {
  try {
    if (!user) {
      chrome.runtime.sendMessage({
        type: 'login',
      })
    }
  } catch (e) {
    console.error(e)
  }
}
const htmlToElem = html => {
  let temp = document.createElement('template')
  html = html.trim()
  temp.innerHTML = html
  return temp.content.firstChild
}
const hashCode = string => {
  let hash = 0
  let i, chr
  if (string.length === 0) return hash
  for (i = 0; i < string.length; i++) {
    chr = string.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return hash
}
const getMessages = async (save = false) => {
  const chat = document.querySelector('[aria-live="polite"]')
  const mess = []
  Array.from(chat.children).forEach(c => {
    if (c.id !== 'meeting-old-messages') {
      const time = c.getAttribute('data-formatted-timestamp')
      const who = c.children[0].children[0].innerHTML
      Array.from(c.children[1].children).forEach(e => {
        if (save) {
          if (!e.classList.contains('saved')) {
            e.classList.add('saved')
            mess.push({
              date: new Date().toISOString().substring(0, 10),
              time,
              who,
              message: e.innerHTML,
            })
          }
        } else {
          mess.push({
            date: new Date().toISOString().substring(0, 10),
            time,
            who,
            message: e.innerHTML,
          })
        }
      })
    }
  })
  return mess
}
const getCsvMessages = async () => {
  const messages = await getAllMessages()
  let csv = 'time,who,message\n'
  messages.forEach(m => {
    csv += `${m.time},${m.who},${m.message}\n`
  })
  return csv
}
const getConvertedSavedMessage = async () => {
  const mess = []
  const savedMessage = await getSavedMessages()
  savedMessage.forEach(m => {
    m.messages.forEach(me => {
      mess.push({
        date: m.date,
        time: m.time,
        who: m.who,
        message: me,
      })
    })
  })
  return mess
}
const getAllMessages = async () => {
  const savedMessages = await getConvertedSavedMessage()
  const messages = await getMessages()
  return [...savedMessages, ...messages]
}
const getSavedMessagesFromStore = () => {
  const defaultPreset = {
    id: null,
    messages: []
  }
  return new Promise((resolve) => {
    const id = getMeetId()
    const transaction = db.transaction('chat', 'readonly')
    const chatStore = transaction.objectStore('chat')
    const getChatStore = chatStore.get(id)
    getChatStore.onsuccess = () => {
      resolve(getChatStore.result || defaultPreset)
    }
    getChatStore.onerror = () => {
      resolve(defaultPreset)
    }
  })
}
const getSavedMessages = async () => {
  let { messages } = await getSavedMessagesFromStore()
  let output = []
  let currentStructure = {}

  messages.forEach(({ date, time, who, message }) => {
    if (
      !currentStructure.who ||
      currentStructure.who !== who ||
      currentStructure.time !== time
    ) {
      if (currentStructure.who) output.push(currentStructure)

      const splitDate = date.split('-')
      currentStructure = {
        who,
        time,
        date: `${splitDate[2]}/${splitDate[1]}`,
        messages: [message],
      }
    } else {
      currentStructure.messages.push(message)
    }
  })

  if (currentStructure.who) output.push(currentStructure)
  return output
}
const saveMessages = async () => {
  const messages = await getMessages(true)
  return new Promise((resolve) => {
    const id = getMeetId()
    const transaction = db.transaction('chat', 'readwrite')
    const chatStore = transaction.objectStore('chat')
    const getChatStore = chatStore.get(id)
    getChatStore.onsuccess = () => {
      let newChat = getChatStore.result
      if (newChat) {
        newChat.messages = [...newChat.messages, ...messages]
        const updateRequest = chatStore.put(newChat)
        updateRequest.onsuccess = () => {
          console.log('Chat updated')
          resolve()
        }
        updateRequest.onerror = () => {
          console.error('Chat not updated')
          resolve('ERROR')
        }
      } else {
        const addRequest = chatStore.add({
          id,
          messages
        })
        addRequest.onsuccess = () => {
          console.log('Chat add')
          resolve()
        }
        addRequest.onerror = () => {
          console.error('Chat not add')
          resolve('ERROR')
        }
      }
    }
  })
}
const getMeetId = () => document.location.pathname.substring(1)
const getDate = () => new Date().toISOString().substring(0, 10)
const sendByEmailMessages = async () => {
  const text = await getTranscriptMessage()
  window.open(`mailto:?body=${encodeURIComponent(text)}`, '_self')
}
const downloadCsvMessages = async () => {
  const messages = await getCsvMessages()
  const element = document.createElement('a')
  element.setAttribute('href', `data:application/octet-stream,${encodeURIComponent(messages)}`)
  element.setAttribute('download', `chat-${getMeetId()}-${new Date().toISOString().substring(0, 10)}.csv`)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}
const getTranscriptMessage = async () => {
  let text = ''
  const messages = await getAllMessages()
  messages.forEach(m => {
    text += `${m.time} - ${m.who}: ${m.message}\n`
  })
  return text
}
const copyClipBoardMessages = async () => {
  let toCopy = await getTranscriptMessage()
  await navigator.clipboard.writeText(toCopy)
}
const getCheckUserById = async id => {
  return new Promise((resolve) => {
    const transaction = db.transaction('checkUser', 'readonly')
    const checkUserStore = transaction.objectStore('checkUser')
    const user = checkUserStore.get(id)
    user.onsuccess = (event) => {
      resolve(event.target.result)
    }
    user.onerror = () => {
      resolve(null)
    }
  })
}
const updateCheckUser = async (checkUserId, participants) => {
  return new Promise((resolve) => {
    const transaction = db.transaction('checkUser', 'readwrite')
    const checkUserStore = transaction.objectStore('checkUser')
    const getCheckUserStore = checkUserStore.get(checkUserId)
    const newVal = {
      id: checkUserId,
      participants
    }
    getCheckUserStore.onsuccess = () => {
      let newCheckUser = getCheckUserStore.result
      if (newCheckUser) {
        const updateRequest = checkUserStore.put(newVal)
        updateRequest.onsuccess = () => {
          console.log('Checkbox updated')
          resolve()
        }
        updateRequest.onerror = () => {
          console.log('Checkbox not updated')
          resolve('ERROR')
        }
      } else {
        const addRequest = checkUserStore.add(newVal)
        addRequest.onsuccess = () => {
          console.log('Checkbox add')
          resolve()
        }
        addRequest.onerror = () => {
          console.log('Checkbox not add')
          resolve('ERROR')
        }
      }
    }
  })
}
const addChatButtons = async () => {
  const chatWrapper = document.querySelector('[aria-live="polite"]')
  if (chatWrapper && !document.getElementById('meeting-ext-button')) {
    chatWrapper.parentNode.appendChild(htmlToElem(`
      <div id="meeting-ext-button">
        <div id="meeting-ext-button-copy" class="meeting-ext-buttons">
          Copy chat
        </div>
        <div id="meeting-ext-button-download" class="meeting-ext-buttons">
          Download csv
        </div>
        <div id="meeting-ext-button-send-by-email" class="meeting-ext-buttons">
          Send email
        </div>
      </div>
    `))
    document.getElementById('meeting-ext-button-copy').addEventListener('click', copyClipBoardMessages)
    document.getElementById('meeting-ext-button-download').addEventListener('click', downloadCsvMessages)
    document.getElementById('meeting-ext-button-send-by-email').addEventListener('click', sendByEmailMessages)
    setInterval(async () => {
      await saveMessages()
    }, 30000)
  }
}
const addChatHistory = async () => {
  const meetingOldMessages = document.getElementById('meeting-old-messages')
  if (!meetingOldMessages) {
    const chatWrapper = document.querySelector('[aria-live="polite"]')
    const messages = await getSavedMessages()
    chatWrapper.insertBefore(htmlToElem(`
      <div id="meeting-old-messages">
        ${messages.map(m => `
          <div class="chat-wrapper">
            <div>
              <div class="chat-who">${m.who}</div>
              <div class="chat-time">${m.time} ${m.date}</div>
            </div>
            <div class="chat-message-wrapper">
              ${m.messages.map(me => `
                <div class="chat-message saved">${me}</div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `), chatWrapper.firstChild)
  }
}

let checkUserById = null
let participants = {}
const addCheckbox = async () => {
  const list = document.querySelector('[role="list"]')
  if (list) {
    if (!checkUserById) {
      checkUserById = await getCheckUserById(checkUserId)
      if (checkUserById) {
        participants = checkUserById.participants
      }
    }
    Array.from(list?.children || []).forEach(c => {
      const user = c.children[0]
      if (!c.children[0].children[0].classList.contains('meeting-check')) {
        const hash = hashCode(user.children[1].children[0].textContent)
        user.children[0].parentNode.insertBefore(
          htmlToElem(`<input type="checkbox" id="${hash}" class="meeting-check" ${!!participants[hash] ? 'checked' : ''} />`),
          user.children[0]
        )
        document.getElementById(hash.toString()).addEventListener('change', async e => {
          participants[e.target.id] = !participants[e.target.id]
          await updateCheckUser(checkUserId, participants)
        })
      }
    })
  }
}

async function fetchGoogleApi(path, options) {
  const { access_token } = user
  return fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    ...options,
  });
}

function getStartOfDay() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return startOfDay.toISOString();
}

function getEndOfDay() {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return endOfDay.toISOString();
}
async function getGoogleEvents() {
  const timeMin = getStartOfDay();
  const timeMax = getEndOfDay();

  const res = await fetchGoogleApi(
    `calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
    { method: 'GET' }
  );

  if (!res.ok) {
    return null
  }

  const events = await res.json()
  return events.items || []
}
const getUser = async () => {
  try {
    return new Promise((resolve) => {
      console.log('getUser')
      chrome.storage.local.get(['user']).then((result) => {
        resolve(result.user)
      })
    })
  } catch (e) {
    resolve(null)
  }
}

const setUser = async user => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ user }).then((result) => {
      resolve(result)
    })
  })
}

const setTimerText = (seconds, time) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds - (hours * 3600)) / 60)
  const second = seconds - (hours * 3600) - (minutes * 60)
  const formattedSecond = second < 10 ? `0${second}` : second
  const formattedMinute = minutes < 10 ? `0${minutes}` : minutes
  const formattedHour = hours < 10 ? `0${hours}` : hours
  const formattedTime = `${formattedHour}:${formattedMinute}:${formattedSecond}`
  time.innerHTML = formattedTime
}

const checkUserFromStorage = async (fetchEvent) => {
  const loginBtn = document.getElementById('login')
  const userSvg = document.getElementById('user-svg')
  const userImg = document.getElementById('user-img')

  if (!userSvg.style.display || userSvg.style.display !== 'none') {
    user = await getUser()
    if (user) {
      userSvg.style.display = 'none'
      userImg.style.display = 'block'
      userImg.src = user.picture
      loginBtn.style.cursor = 'default'
      if (fetchEvent) {
        const events = await getGoogleEvents()
        if (events) {
          currentEvent = events.find(e => window.location.href.includes(e.hangoutLink))
          nextEvent = events.find(e => new Date(e.start.dateTime) > new Date())
          if (currentEvent) {
            const progressContent = document.getElementById('progress-content')
            progressContent.style.display = 'block'
            const time = document.getElementById('time')
            time.style.marginTop = '-4px'
            currentEventStart = new Date(currentEvent.start.dateTime)
            currentEventEnd = new Date(currentEvent.end.dateTime)
          }
        }
      }
    }
  }
}

let user = null

const start = new Date()
let currentEvent = null
let nextEvent = null
let currentEventStart = null
let currentEventEnd = null

getUser().then(async u => {
  const timer = document.createElement('div')
  timer.id = 'timer'
  timer.innerHTML = '' +
    '<div id="progress-content">' +
      '<div id="progress"></div>' +
    '</div>' +
    '<span id="active"></span>' +
    '<span id="time"></span>' +
    '<span id="login">' +
      '<span id="user-svg">' +
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><defs><style>.cls-1{fill:#606161;}</style></defs><title/><g data-name="Layer 7" id="Layer_7"><path class="cls-1" d="M19.75,15.67a6,6,0,1,0-7.51,0A11,11,0,0,0,5,26v1H27V26A11,11,0,0,0,19.75,15.67ZM12,11a4,4,0,1,1,4,4A4,4,0,0,1,12,11ZM7.06,25a9,9,0,0,1,17.89,0Z"/></g></svg>' +
      '</span>' +
      '<img id="user-img"></img>' +
    '</span>' +
    '<div id="others-info">' +
      '<div id="start-content"><span>Start from: </span><span id="start"></span></div>' +
      '<div id="next-content"><span>Next meet in: </span><span id="next"></span></div>' +
    '</div>'
  document.body.appendChild(timer)
  user = u
  const loginBtn = document.getElementById('login')
  const userSvg = document.getElementById('user-svg')
  const userImg = document.getElementById('user-img')
  const othersInfo = document.getElementById('others-info')
  loginBtn.addEventListener('click', login)
  timer.addEventListener('click', () => {
    if (user && (currentEvent || nextEvent)) {
      othersInfo.style.display = !othersInfo.style.display || othersInfo.style.display === 'none' ? 'flex' : 'none'
    }
  })
  if (user) {
    const events = await getGoogleEvents()
    if (events) {
      currentEvent = events.find(e => window.location.href.includes(e.hangoutLink))
      nextEvent = events.find(e => new Date(e.start.dateTime) > new Date())
      const progressContent = document.getElementById('progress-content')
      progressContent.style.display = 'block'
      const time = document.getElementById('time')
      time.style.marginTop = '-4px'
      await checkUserFromStorage(false)
    } else {
      userSvg.style.display = 'block'
      userImg.style.display = 'none'
      loginBtn.style.cursor = 'pointer'
      user = null
      setUser(null)
    }
  }
  if (user && currentEvent) {
    currentEventStart = new Date(currentEvent.start.dateTime)
    currentEventEnd = new Date(currentEvent.end.dateTime)
  }
  setInterval(async () => {
    await checkUserFromStorage(true)
    const now = new Date()
    const secondsStart = parseInt((now - start) / 1000)

    const startContent = document.getElementById('start-content')
    const startText = document.getElementById('start')
    const nextContent = document.getElementById('next-content')
    const nextText = document.getElementById('next')

    if (user && currentEvent) {
      const progress = document.getElementById('progress')
      const isStarted = now > currentEventStart
      const isFinished = now > currentEventEnd
      if (isStarted && !isFinished) {
        const percent = 100 - ((currentEventEnd - now) / (currentEventEnd - currentEventStart) * 100)
        progress.style.width = `${parseInt(percent <= 100 ? percent : 100)}%`
      }
      const seconds = parseInt((currentEventEnd - now) / 1000)
      setTimerText(Math.abs(seconds), time)
      setTimerText(secondsStart, startText)
      if (isFinished) {
        timer.classList.add('is-finished')
      } else {
        timer.classList.remove('is-finished')
      }
      if (!isStarted) {
        timer.classList.add('not-started')
      } else {
        timer.classList.remove('not-started')
      }
    } else {
      setTimerText(secondsStart, time)
      const startContent = document.getElementById('start-content')
      startContent.style.display = 'none'
    }
    if (nextEvent) {
      const seconds = parseInt((new Date(nextEvent.start.dateTime) - now) / 1000)
      setTimerText(seconds, nextText)
    } else {
      nextContent.style.display = 'none'
    }
  }, 1000)
})

const date = getDate()
const meetId = getMeetId()
const checkUserId = `${date}-${meetId}`

if (meetId) {
  parent.addEventListener('click', async event => {
    setTimeout(async () => {
      switch (event.target.innerText) {
        case 'chat':
        case 'chat_bubble':
          await addChatHistory()
          await addChatButtons()
          break
        case 'people_outline':
        case 'people_alt':
          await addCheckbox()
          break
        default:
          break
      }
    }, 200)
  })
}

setInterval(async () => {
  await addCheckbox()
}, 10000)
