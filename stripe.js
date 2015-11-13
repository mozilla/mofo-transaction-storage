const ZERO_DECIMAL_CURRENCIES = [
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF'
];

// Config
var Habitat = require('habitat');
Habitat.load();

var stripe = require('stripe')(process.env.STRIPE_API_KEY);
var oxr = require('open-exchange-rates');
var money = require('money');
var moment = require("moment");

oxr.set({ app_id: process.env.OXR_APP_ID });

function updateExchangeRates() {
  oxr.latest(function() {
    money.rates = oxr.rates;
    money.base = oxr.base;
  });
}

updateExchangeRates();

// update exchange rates every hour
setInterval(updateExchangeRates, 1000 * 60 * 60);

var pg;
try {
  pg = require('pg').native;
} catch (ignore_error) {
  pg = require('pg');
}

var insert_query = 'INSERT INTO stripe (id, timestamp, amount, settle_amount, ' +
                   'refunded, currency, status, country_code, name, email ) ' +
                   'SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10';
var update_query = 'UPDATE stripe SET timestamp=$2, amount=$3, settle_amount=$4, ' +
                   'refunded=$5, currency=$6, status=$7, country_code=$8, ' +
                   ' name=$9, email=$10';
var upsert_query = `WITH upsert AS (${update_query} RETURNING *) ${insert_query}` +
                   ' WHERE NOT EXISTS (SELECT * FROM upsert);';

module.exports = function(request, reply) {
 // stripe doesn't care about the result of this request, so end the request.
  reply();

  var event = request.payload;

if (event && event.data && event.data.object) {
    // verify that this is a real stripe charge associated with our stripe account.
    verify_charge(event);
  }

};

function verify_charge(event) {
  // stripe.events.retrieve(
  //   event.data.object.id,
  //   process_charge
  // );

  process_charge(null, event.data.object);
}

function process_charge(err, charge) {
  if (err) {
    console.log(`Error while verifying charge with stripe: ${err.toString()}`);
    return;
  }

  pg.connect(process.env.STRIPE_DB_CONNECTION_STRING), function(err, client, done) {
    if (err) {
      console.error(`Error while connecting to db: ${err.toString()}`);
      return;
    }

    var amount,
        adjustedAmount,
        currency = charge.currency.toUpperCase();

    adjustedAmount = amount = charge.amount

    if (ZERO_DECIMAL_CURRENCIES.indexOf(charge.currency) === -1) {
      adjustedAmount = adjustedAmount / 100;
    }

    var settle_amount = money(adjustedAmount).from(currency).to('USD');

    client.query(upsert_query, [
      charge.id,
      new Date(charge.created).toISOString(),
      amount,
      settle_amount,
      charge.amount_refunded,
      currency,
      charge.status,
      charge.source.address_country,
      charge.name,
      charge.metadata.email
    ], function(err, result) {
      if (err) {
        console.error(`Error while upserting charge: ${err.toString()}`);
      }
    });
  });
}
