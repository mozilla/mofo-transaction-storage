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
var moment = require('moment');

oxr.set({ app_id: process.env.OXR_APP_ID });

function update_money(done) {
  if (!done) {
    done = function() {};
  }

  return function() {
    money.rates = oxr.rates;
    money.base = oxr.base;
    done();
  };
}

function update_exchange_rates(date, done) {
  done = update_money(done);

  if (date) {
    return oxr.historical(date, done);
  }

  oxr.latest(done);
}

update_exchange_rates();

// update exchange rates every hour
setInterval(update_exchange_rates, 1000 * 60 * 60);

var pg;
try {
  pg = require('pg').native;
} catch (ignore_error) {
  pg = require('pg');
}

var insert_query = 'INSERT INTO stripe (id, timestamp, amount, settle_amount, ' +
                   'refunded, currency, status, country_code, name, email, recurring ) ' +
                   'SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11';
var update_query = 'UPDATE stripe SET timestamp=$2, amount=$3, settle_amount=$4, ' +
                   'refunded=$5, currency=$6, status=$7, country_code=$8, ' +
                   ' name=$9, email=$10, recurring=$11 WHERE id=$1';
var upsert_query = `WITH upsert AS (${update_query} RETURNING *) ${insert_query}` +
                   ' WHERE NOT EXISTS (SELECT * FROM upsert);';

function process_charge(charge, callback) {
  if (!callback) {
    callback = function() {};
  }

  stripe.customers.retrieve(charge.customer, (customer_error, customer) => {
    if (customer_error) {
      return callback(customer_error);
    }

    charge.customer = customer;

    pg.connect(process.env.STRIPE_DB_CONNECTION_STRING, function(connect_error, client, done) {
      if (connect_error) {
        console.error(`Error while connecting to db: ${connect_error.toString()}`);
        done();
        return callback(connect_error);
      }

      var adjusted_amount = charge.amount;
      var adjusted_amount_refunded = charge.amount_refunded;
      var currency = charge.currency.toUpperCase();

      if (ZERO_DECIMAL_CURRENCIES.indexOf(currency) === -1) {
        adjusted_amount = adjusted_amount / 100;
        // don't divide with 0 :)
        if (adjusted_amount_refunded) {
          adjusted_amount_refunded = adjusted_amount_refunded / 100;
        }
      }

      var settle_amount = money(adjusted_amount).from(currency).to('USD');

      client.query(upsert_query, [
        charge.id,
        moment.unix(charge.created).toISOString(),
        adjusted_amount,
        settle_amount,
        adjusted_amount_refunded,
        currency,
        charge.status,
        charge.source.country,
        charge.source.name,
        charge.customer.email,
        !!charge.invoice
      ], function(query_error, result) {
        done();
        if (query_error) {
          console.error(`Error while upserting charge: ${query_error.toString()}`);
          return callback(query_error);
        }
        callback();
      });
    });
  });
}

module.exports = {
  process_charge,
  stripe,
  update_exchange_rates
};
