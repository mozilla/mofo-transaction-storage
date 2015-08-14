// Config
var Habitat = require("habitat");
Habitat.load();
var env = new Habitat();

var async = require("async");
var moment = require("moment");
var pg;
try {
  pg = require("pg").native;
} catch () {
  pg = require("pg");
}

var search_transactions = require("./lib/search")(
  env.get("PAYPAL_USERNAME"),
  env.get("PAYPAL_PASSWORD"),
  env.get("PAYPAL_SIGNATURE")
);

var start_date = moment.utc(env.get("PAYPAL_START_DATE"));
var step_minutes = env.get("PAYPAL_STEP_MINUTES");
var insert_query = "INSERT INTO paypal (id, timestamp, type, email, name, status, " +
                   "amount, fee_amount, currency) " +
                   "SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9";
var update_query = "UPDATE paypal SET timestamp=$2, type=$3, email=$4, name=$5, " +
                   "status=$6, amount=$7, fee_amount=$8, currency=$9 WHERE id = $1";
var upsert_query = "WITH upsert AS (" + update_query + " RETURNING *) " + insert_query +
                   " WHERE NOT EXISTS (SELECT * FROM upsert);";

var start_marker = moment.utc(start_date);
var end_marker = moment.utc(start_date).add(step_minutes, 'minutes');
var step_marker = step_minutes;

async.forever(function(next) {

  console.log("%s -> %s (step %d minutes)", start_marker.toISOString(), end_marker ? end_marker.toISOString() : null, step_marker);
  var search_fn = async.apply(search_transactions, start_marker.toISOString(), end_marker ? end_marker.toISOString() : null);

  async.retry(search_fn, function(err, transactions) {
    if (err) {
      return next(err);
    }

    if (!Array.isArray(transactions.L)) {
      transactions.L = [];
    }

    var list = transactions.L;
    var length = transactions.L.length;

    if (length === 100) {
      // Maximum number of transactions found for this time period, cut time range in half
      step_marker = step_marker / 2;
      end_marker = moment.utc(start_marker).add(step_marker, 'minutes');
      return next();
    }

    var now = moment.utc();

    if (end_marker && end_marker < now) {
      start_marker = end_marker;
      end_marker = moment.utc(start_marker).add(step_marker, 'minutes');
    } else {
      start_marker = moment.utc(now).subtract(step_marker, 'minutes');
      end_marker = null
    }

    console.log("Added %d transactions", length);
    q.push(list);

    if (end_marker) {
      return next();
    }


    var nextTickTime = step_marker / 4;
    console.log('Caught up to current time, sleeping for %d minutes', nextTickTime);
    setTimeout(next, nextTickTime * 60 * 1000);
  });
}, function(error) {
  throw error;
});

var q = async.queue(function(task, next) {
  pg.connect(env.get("PAYPAL_DB_CONNECTION_STRING"), function(err, client, done) {
    if (err) {
      return next(err);
    }

    client.query(upsert_query, [
      task.TRANSACTIONID,
      task.TIMESTAMP,
      task.TYPE,
      task.EMAIL,
      task.NAME,
      task.STATUS,
      task.AMT,
      task.FEEAMT,
      task.CURRENCYCODE
    ], function(err, result) {
      done();
      next(err);
    });
  });
}, 1);
