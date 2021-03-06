'use strict'

const electron = require('electron')
const {app, BrowserWindow, Menu, shell, dialog, ipcMain} = electron
const path = require('path')
const url = require('url')
const defaultMenu = require('electron-default-menu')
const fs = require('fs')
const storage = require('./storage')
const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');


installExtension(REACT_DEVELOPER_TOOLS).then((name) => {
  console.log(`Added Extension:  ${name}`);
})
.catch((err) => {
  console.log('An error occurred: ', err);
});

let mainWindow
let findWindow
let startWindow

app.on('ready', function createWindow () {
  let size = electron.screen.getPrimaryDisplay().workAreaSize
  let lastWindowState = storage.get('lastWindowState')
  if (lastWindowState === null) {
    lastWindowState = {
      width: Math.max(size.width, size.height) * 0.65,
      height: Math.max(size.width, size.height) * 0.4,
      maximized: false
    }
  }
  mainWindow = new BrowserWindow({
    x: lastWindowState.x,
    y: lastWindowState.y,
    width: lastWindowState.width,
    height: lastWindowState.height,
    content: lastWindowState.content,
    minWidth: 800,
    minHeight: 400,
    darkTheme: true,
    backgroundColor: '#373a47'
  })

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/app/index.html'),
    protocal: 'file:',
    slashes: true
  }))

  startWindow = new BrowserWindow({
    parent: mainWindow,
    width: 800,
    height: 200,
    show: true,
    frame: false,
    resize: true,
    center: true,
    minWidth: 800,
    minHeight: 200,
    maxWidth: 800,
    maxHeight: 200,
    backgroundColor: '#373a47',
  })
  startWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/app/start.html'),
    protocal: 'file:',
    slashes: true,
  }))

  findWindow = new BrowserWindow({
    x: lastWindowState.x + 30,
    y: lastWindowState.y + 70,
    width: 350,
    height: 60,
    show: false,
    frame: false,
    parent: mainWindow,
    resize: false
  })
  findWindow.loadURL(url.format({
    pathname: path.join(__dirname, '/app/find.html'),
    protocal: 'file:',
    slashes: true
  }))

  if (lastWindowState.maximized) {
    mainWindow.maximize()
  }
  mainWindow.on('close', function () {
    let bounds = mainWindow.getBounds()

    storage.set('lastWindowState', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: mainWindow.isMaximized(),
      content: session
    })
  })
})
let session = []
let content = ''

ipcMain.on('asynchronous-message', (ev, contents) => {
  content = contents
})

function tabName (name) {
  let index
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '\\') {
      index = i
    }
  }
  let title = name.substring(index + 1, name.length)
  return title
}

let newFile = function () {
  mainWindow.webContents.send('NewFileMessage', 'untitled')
}

let showOpen = function () {
  dialog.showOpenDialog(function (fileNames) {
    if (fileNames === undefined) {
      console.log('No file selected')
    } else {
      let f = fileNames[0]
      if (f === undefined) return
      readFile(fileNames[0])
      let ipc = require('electron').ipcMain
      ipc.on('invokeAction', function (event) {
        let result = readFile(fileNames[0])
        event.sender.send('actionReply', result)
      })
      let tabTitle = tabName(fileNames[0])
      mainWindow.webContents.send('OpenFile', tabTitle, fileNames)
      mainWindow.webContents.send('currentPath', path)
    }
  })
}

function readFile (filepath) {
  fs.readFile(filepath, 'utf-8', (err, data) => {
    if (err) {
      console.log('An error ocurred reading the file :' + err.message)
    }
  })
}

let currentPath = ''

ipcMain.on('tabPath', (event, path) => {
  currentPath = path
  mainWindow.webContents.send('currentPath', path)
})

ipcMain.on('startPageOkButton', (ev,workDir, refUnit)  => {
  mainWindow.webContents.send('WorkDirAndRefUnitPath', workDir,refUnit)
  startWindow.close()
})

ipcMain.on('brosweWorkDirButtonClicked', (ev)  => {
  const selectedPath = dialog.showOpenDialog({
		properties: ['openDirectory']

  })
  startWindow.webContents.send('selectedWorkDirPath', selectedPath)
})

ipcMain.on('brosweRefUnitButtonClicked', (ev)  => {
  const selectedPath = dialog.showOpenDialog({
		properties: ['openDirectory']

  })
  startWindow.webContents.send('selectedRefUnitPath', selectedPath)
})


let saveFile = function () {
  if (currentPath === '') {
    dialog.showSaveDialog(function (fileName) {
      if (fileName === undefined) {
        console.log("You didn't save the file")
        return
      }
      fs.writeFileSync(fileName, content)
      let titleName = tabName(fileName)
      mainWindow.webContents.send('saveFile', titleName, fileName)
    })
  } else {
    fs.writeFileSync(currentPath, content)
  }
}

let saveAsFile = function () {
  dialog.showSaveDialog(function (fileName) {
    if (fileName === undefined) {
      console.log("You didn't save the file")
      return
    }
    fs.writeFileSync(fileName, content)
    let tabTitle = tabName(fileName)
    mainWindow.webContents.send('saveFile', tabTitle, fileName)
  })
}

let previousString = ''
let activeMatchOrdinal = 1
let resultMatches
ipcMain.on('findString', (event, str) => {
  activeMatchOrdinal = 1
  if (str === '') {

  } else {
    previousString = str
    mainWindow.webContents.findInPage(str)
    mainWindow.webContents.on('found-in-page', (event, result) => {
      resultMatches = result.matches
      if (result.activeMatchOrdinal) {
        this.active = activeMatchOrdinal
      }
      if (result.finalUpdate) {
        this.result_string = `${this.active} of ${result.matches}`
        findWindow.webContents.send('resultMatches', this.result_string)
      }
    })
  }
})

ipcMain.on('replaceString', (event, str) => {
  ipcMain.on('replace', (event, r) => {
    mainWindow.webContents.replace(str)
  })
})

ipcMain.on('findNext', (event, str) => {
  mainWindow.webContents.findInPage(previousString, {findNext: true}, {wordStart: true})
  if (activeMatchOrdinal === resultMatches) {
    activeMatchOrdinal = 1
  } else {
    activeMatchOrdinal += 1
  }
})

ipcMain.on('stopFind', (event, str) => {
  mainWindow.webContents.stopFindInPage('clearSelection')
  findWindow.hide()
})

let find = function () {
  findWindow.show()
}

let Insert = function (path) {
  mainWindow.webContents.send('insertElement', content, path)
}

const menu = defaultMenu(app, shell)

menu.splice(0, 0, {
  label: 'File',
  submenu: [
    {
      label: 'New',
      accelerator: 'Control+N',
      click: function () { newFile() }
    },
    {
      label: 'Open',
      accelerator: 'Control+O',
      click: function () { showOpen() }
    },
    {
      label: 'Save',
      accelerator: 'Control+S',
      click: function () { saveFile() }
    },
    {
      label: 'Save As...',
      accelerator: 'Control+Alt+S',
      click: function () { saveAsFile() }
    },
    {
      label: 'Find',
      accelerator: 'Control+F',
      click: function () { find() }
    },
    {
      label: 'Quit',
      accelerator: 'Alt+F4',
      click: () => { app.quit() }
    }
  ]
})

menu.splice(1, 0, {
  label: 'Insert',
  submenu: [
    {
      label: 'New Link',
      click: function () { Insert('./lib/newLink.xml') }
    },
    {
      label: 'New Joint',
      submenu: [
        {
          label: 'Revolute',
          click: function () { Insert('./lib/Revolute.xml') }
        },
        {
          label: 'Slider',
          click: function () { Insert('./lib/Slider.xml') }
        },
        {
          label: 'Cylindrical',
          click: function () { Insert('./lib/Cylindrical.xml') }
        },
        {
          label: 'Screw',
          click: function () { Insert('./lib/Screw.xml') }
        },
        {
          label: 'Universal',
          click: function () { Insert('./lib/Universal.xml') }
        },
        {
          label: 'Spherical',
          click: function () { Insert('./lib/Spherical.xml') }
        },
        {
          label: 'Planar',
          click: function () { Insert('./lib/Planar.xml') }
        },
        {
          label: 'Fixed',
          click: function () { Insert('./lib/Fixed.xml') }
        },
        {
          label: 'Constant Velocity',
          click: function () { Insert('./lib/ConstantVelocity.xml') }
        },
        {
          label: 'Atpoint',
          click: function () { Insert('./lib/Atpoint.xml') }
        },
        {
          label: 'Inline',
          click: function () { Insert('./lib/Inline.xml') }
        },
        {
          label: 'Inplane',
          click: function () { Insert('./lib/Inplane.xml') }
        },
        {
          label: 'Orientation',
          click: function () { Insert('./lib/Orientation.xml') }
        },
        {
          label: 'Parallel',
          click: function () { Insert('./lib/Parallel.xml') }
        },
        {
          label: 'Perpendicular',
          click: function () { Insert('./lib/Perpendicular.xml') }
        }
      ]
    }
  ]
})

Menu.setApplicationMenu(Menu.buildFromTemplate(menu))
