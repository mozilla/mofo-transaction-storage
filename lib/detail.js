var PayPalNVP = require("paypal-nvp");
var parser = require("paypal-nvp-parser");
var querystring = require("querystring");

module.exports = function(username, password, signature) {
  var api = new PayPalNVP.Paypal_Nvp(username, password, signature);

  return function(transaction_id, callback) {
    api.request({
      METHOD: "GetTransactionDetails",
      TRANSACTIONID: transaction_id
    }, function(err, data) {
      if (err) {
        return callback(err);
      }

      var transaction = parser(data);
      callback(null, transaction);
    });
  };
}
