var Habitat = require("habitat");
Habitat.load();
var env = new Habitat();

var async = require("async");
var pg = require("pg.js");

var transaction_detail = require("./lib/detail")(
  env.get("PAYPAL_USERNAME"),
  env.get("PAYPAL_PASSWORD"),
  env.get("PAYPAL_SIGNATURE")
);

var select_query = "SELECT id AS transaction_id FROM paypal WHERE country_code IS NULL " +
                   "AND (type IN ('Donation', 'Payment', 'Refund', 'Reversal', 'Temporary Hold') " +
                   "OR (type = 'Recurring Payment' AND status = 'Completed'));";
var update_query = "UPDATE paypal SET country_code = $1 WHERE id = $2;";

async.forever(function(next) {
  pg.connect(env.get("PAYPAL_DB_CONNECTION_STRING"), function(connect_error, client, done) {
    client.query(select_query, function(query_error, result) {
      done();
      if (result.rows.length === 0) {
        console.log("Added 0 rows, sleeping for 60 seconds");
        setTimeout(next, 60 * 1000);
        return;
      }
      console.log("Added %d transactions to country codify", result.rows.length);
      detail_q.push(result.rows);
      detail_q.drain = next;
    });
  });
});

var detail_q = async.queue(function(task, next) {
  transaction_detail(task.transaction_id, function(paypal_error, transaction) {
    if (paypal_error) {
      return next(paypal_error);
    }

    update_q.push({
      country_code: transaction.COUNTRYCODE,
      transaction_id: task.transaction_id
    });
    next();
  });
}, 8);

var update_q = async.queue(function(task, next) {
  console.log(task);

  pg.connect(env.get("PAYPAL_DB_CONNECTION_STRING"), function(connect_error, client, done) {
    if (connect_error) {
      return next(connect_error);
    }

    client.query(update_query, [
      task.country_code,
      task.transaction_id
    ], function(query_error, result) {
      done();
      next(query_error);
    });
  });
}, 1);



