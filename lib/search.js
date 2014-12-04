var PayPalNVP = require("paypal-nvp");
var parser = require("paypal-nvp-parser");
var querystring = require("querystring");

module.exports = function(username, password, signature) {
  var api = new PayPalNVP.Paypal_Nvp(username, password, signature);

  return function(start_date, end_date, callback) {
    api.request({
      METHOD: "TransactionSearch",
      STARTDATE: start_date,
      ENDDATE: end_date
    }, function(err, data) {
      if (err) {
        return callback(err);
      }

      var transactions = parser(data);
      callback(null, transactions);
    });
  };
}
