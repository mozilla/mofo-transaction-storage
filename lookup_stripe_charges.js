'use strict';

var lib_stripe = require('./lib/stripe');
var stripe = lib_stripe.stripe;
var process_charge = lib_stripe.process_charge;
var update_exchange_rates = lib_stripe.update_exchange_rates;

var async = require('async');
var moment = require('moment');

var stripe_charge_list_opts = {
  created: {
    lte: moment.unix(new Date()).valueOf()
  },
  limit: 100
};

var charges;
var last_oxr_date;

function update_exchange_rates_for_date(charge, done) {
  var charge_date = moment.unix(charge.created).format("YYYY-MM-DD");

  if (last_oxr_date === charge_date) {
    return done(null, charge);
  }

  console.log(`Updating exchange rates to ${charge_date}`);

  update_exchange_rates(charge_date, function() {
    last_oxr_date = charge_date;
    done(null, charge);
  });
}

function process_charge_data(charge, done) {
  console.log(`processing charge ${charge.id}`);

  async.waterfall([
    function(cb) {
      cb(null, charge);
    },
    update_exchange_rates_for_date,
    process_charge
  ], done);
}

async.doWhilst(function(done) {
  stripe.charges.list(
    stripe_charge_list_opts,
    function(err, resp) {
      if (err) {
        return done(err);
      }
      charges = resp;
      console.log(charges.data.length);
      async.eachSeries(
        charges.data,
        process_charge_data,
        done
      );
    }
  );
}, function() {
  if (charges.has_more) {
    console.log('Fetching next page of charges...');
    stripe_charge_list_opts = {
      starting_after: charges.data[charges.data.length - 1].id,
      limit: 100
    }
  }
  return charges.has_more;
}, function(err) {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Done!');
  process.exit(0);
});
