var Boom = require('boom');
var process_charge = require('./lib/stripe').process_charge;

// Configure stripe to only hit this endpoint with the following events:
const allowed_events = [
  "charge.succeeded",
  "charge.captured",
  "charge.failed",
  "charge.refunded",
  "charge.updated"
];

module.exports = function(request, reply) {
  var event = request.payload;

  if (allowed_events.indexOf(event.type.toLowerCase()) === -1 {
    return reply("Event type not supported");
  }

  return process_charge(event.data.object, function(err) {
    if (err) {
      return reply(boom.wrap(err));
    }
    reply();
  });
};
