window.onload = function () {
  "use strict";

  var udp_mode = true

  console.log('main.js / window.onload anonymous function')

  var message_to_send = 'this is a test that the modulation / demodulation works correctly \nalso bumping the speed up to >200 baud, this rules!! \n'
  var output_msg = ''

  var Agent = require('./agent.js')
  var View_Controller = require('./view_controller.js')

  window.alice = Agent.agent()
  alice.init({
    type: 'client',
    message: 'ffff'
  })

  window.bob = Agent.agent()
  bob.init({
    type: 'server',
    message: message_to_send
  })

  var display = View_Controller.view_controller('alice_modem')
  display.connect(alice)

  var dataArray = alice.getBuffer()
    // var bufferLength = dataArray.length
  var bufferLength = 512



  window.byte_to_code = 0



  var prev_ranges = []

  alice.connect(bob)
  bob.connect(alice)

  // create alice modem elements
  // var div_alice_parent = d3.select('div#alice_modem')
  //
  // var div_state = div_alice_parent.append('div')
  // var div_baud = div_alice_parent.append('div')
  // var div_rx_buffer = div_alice_parent.append('pre')

  setTimeout(draw, 200)

  function draw() {

    var stats = alice.get_state()

    // div_state.html('STATE: ' + stats.CURRENT_STATE)
    // div_rx_buffer.html('RX BUF: ' + stats.RX_BUFFER)
    //
    // var baud = 8 * (stats.RX_BUFFER.length / ((Date.now() - stats.CONNECTED_AT) / 1000.0))
    //
    // div_baud.html('BAUD: ' + baud)

    dataArray = alice.getBuffer()


    var o = alice.tick()

    // if(o.new_data){
    //   output_msg += o.data
    //   d3.select('pre.output_msg').html(output_msg)
    // }

    bob.tick()

    display.tick()

    setTimeout(draw, 30)

    // window.requestAnimationFrame(draw);

  }



}
