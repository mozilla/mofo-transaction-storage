var Habitat = require("habitat");
Habitat.load();
var env = new Habitat();

var transaction_detail = require("./lib/detail")(
  env.get("PAYPAL_USERNAME"),
  env.get("PAYPAL_PASSWORD"),
  env.get("PAYPAL_SIGNATURE")
);

transaction_detail(process.argv[2], function(paypal_error, transaction) {
  if (paypal_error) {
    return console.error(paypal_error);
  }

  console.log(transaction);
});
