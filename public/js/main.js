var fs = require('fs')

var webcam = require('./webcam_load.js')
var init = require('./init.js')

window.onload = function(){
  console.log('window.onload zomq')

  webcam()
  init()

}
