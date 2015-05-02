alice sends on SignalA
bob hears SignalA and sends on SignalA
alice hears on SignalA and sends only on SignalB
bob hears on SignalB and sends only on SignalA

-- handshake complete

alice encodes infobit channels
alice sends on SignalA
alice now listens for bobs ack on SignalA
bob hears on SignalA and reads info bits
bob sends on SignalA to ack
bob begins listening for new signal on SignalB
alice hears ack on SignalA
alice encodes infobit channels
alice sends on SignalB
alice now listens for bobs ack on SignalB
bob hears on SignalB and reads info bits
bob sends on SignalB to ack
bob begins listening for new signal on SignalA
• repeat
