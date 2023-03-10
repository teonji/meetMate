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
    }, 60000)
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
