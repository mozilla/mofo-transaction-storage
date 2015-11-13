var process_charge = require('./lib/stripe').process_charge;

module.exports = function(request, reply) {
 // stripe doesn't care about the result of this request, so end the request.
  reply();

  var event = request.payload;

if (event && event.data && event.data.object) {
    // verify that this is a real stripe charge associated with our stripe account.
    process_charge(event.data.object);
  }
};
