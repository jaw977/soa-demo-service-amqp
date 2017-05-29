## SOA Demo:  Service class using AMQP (RabbitMQ)

Class for creating services.  It allows services to define async (Promise returning) functions defining how to respond to commands and events.  The services may listen and respond to messages on an AMQP queue.  The services may publish events, or subscribe to other services' events.  Usage:

```javascript
const Service = require('soa-demo-service-amqp');

// Instantiate a service that may listen for messages in the "bid" queue.
const service = Service.new("bid");

// Messages which include "cmd":"add" will use the addBid function to handle the message (which must return a Promise). 
service.add("cmd:add", addBid);

// Similar to the above, but will also subscribe to messages from other services which include "event":"addUser"
service.add("event:addUser", addUser);

// Send a request message, which will be routed to the appropriate service
const responsePromise = service.request(message);

// Publish an event message: {event:"addListing", listingId:1}
service.publish("addListing", {listingId:1});

// Listen for requests
service.listen();
```

The URL for the RabbitMQ messaging server is passed in environment variable `RABBITMQ_URL`, which defaults to `amqp://localhost`
