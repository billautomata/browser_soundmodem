##todo

- [ ] automatic timeout/reconnect

#JSAM protocol spec

the modem as a state machine with the following states:

```
id:     -1
name:   setup

description:
  create oscillators
  create gains
  connect peer gains to internal analyser

```

```
id:     0
name:   idle

internal_state:
  NUM_GROUPS - the number of peaks found in the FFT spectrum

description:
  broadcasting on all 10 channels at full power

  counting the number of distinct groups

  after finding 10 groups moving on

each_tick:
  each tick analyses the spectrum
    counts the number of peak groups
    stores the number of peak groups in NUM_GROUPS

next_state:
  if(NUM_GROUPS === 10) GOTO STATE 1 after 200ms

```

```
id:     1
name:   connecting

internal_state:
  FLIP_FLOP:  [bool]
  CURRENT_STATE: [bool,bool]
  PREV_STATE: [bool,bool], init:[-1]
  SYNC_COUNTS: [int]

description:
  broadcasting full power on the first 8 channels
  broadcasting flip flopping on channels 8 and 9 to coordinate changes
  listening for flip flops on channel 8 and 9 and reading changes

  after 2 coordinated changes, move on

each_tick:

  // [perform signaling]
  if FLIP_FLOP is true {
    write ch8(full) write ch9(none)
  } else {
    write ch8(none) write ch9(full)
  }
  FLIP_FLOP = !FLIP_FLOP

  // [looks for signaling]
  reads the state of ch8 and ch9 [bool,bool]
  if ch8 and ch9 are different {
    store as the CURRENT_STATE
    if PREV_STATE is not -1 {
      compare CURRENT_STATE to PREV_STATE [bool]
      if they are different {
        flip flop ch8 and ch9
        increment SYNC_COUNTS
      }
    }
    // [save that analysis]
    store CURRENT_STATE as PREV_STATE

  } else {
    // do nothing
  }

next_state:
  if(SYNC_COUNTS === 2) GOTO STATE 2

```







```
id:     2
name:   connected

internal_state:
  MESSAGE: [int-array]
  MESSAGE_IDX: [int], init:[0]
  CURRENT_BYTE: [int]
  CURRENT_STATE: [bool,bool]
  PREV_STATE: [bool,bool], init:[-1]

description:
  encoding information on channels 0 through 7
  broadcasting flip flopping on channels 8 and 9 to coordinate
  listening for flip flops on channel 8 and 9 to trigger new encodings

each_tick:

  // [perform signaling]
  if FLIP_FLOP is true {
    write ch9(full) write ch10(none)
  } else {
    write ch9(none) write ch10(full)
  }
  FLIP_FLOP = !FLIP_FLOP

  // [writes current byte to spectrum]
  get/set the CURRENT_BYTE from the MESSAGE with the MESSAGE_IDX
  encode the CURRENT_BYTE into ch0 - ch8

  // [looks for signaling]
  reads the state of ch9 and ch10 [bool,bool]
  if ch9 and ch10 are different {
    store as the CURRENT_STATE
    if PREV_STATE is not -1 {
      compare CURRENT_STATE to PREV_STATE [bool]
      if they are different {

        //[read new byte]
        decode ch0 - ch7

        flip flop ch9 and ch 10
        increment MESSAGE_IDX
      }
    }
    // [save that analysis]
    store CURRENT_STATE as PREV_STATE
  } else {
    // do nothing
  }

next_state:
  none

```
