window.onload = function () {
  "use strict";

  var udp_mode = true

  console.log('main.js / window.onload anonymous function')

  var message_to_send = 'this is a test that the modulation / demodulation works correctly'
  var output_msg = ''

  var Agent = require('./agent.js')
  var View_Controller = require('./view_controller.js')

  window.alice = Agent.agent()
  alice.init({
    type: 'client',
    message: '... =) ... '
  })

  window.bob = Agent.agent()
  bob.init({
    type: 'server',
    message: message_to_send
  })

  var display = View_Controller.view_controller('alice_modem')
  display.connect(alice)

  var display_bob = View_Controller.view_controller('bob_modem')
  display_bob.connect(bob)

  alice.connect(bob)
  bob.connect(alice)

  setTimeout(draw, 200)

  function draw() {

    var o = alice.tick()
    bob.tick()

    display.tick()
    display_bob.tick()

    setTimeout(draw, 40)
    // window.requestAnimationFrame(draw);

  }

}
