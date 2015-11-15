// Config
var Habitat = require("habitat");
Habitat.load();
var env = new Habitat();
var config = env.get("SERVER");
config.port = env.get("PORT");

var Boom = require("boom");
var Hapi = require("hapi");
var pg;
try {
  pg = require("pg").native;
} catch (ignore_error) {
  pg = require("pg");
}

var total_query = "SELECT SUM(settle_amount)::numeric FROM paypal WHERE timestamp > $1 AND timestamp < $2 " +
                   "AND ((type IN ('Donation', 'Payment') AND status = 'Completed') " +
                   "OR type = 'Temporary Hold');";
var bycountry_query = "SELECT country_code, sum(amount)::numeric, count(*) FROM paypal " +
                      "WHERE timestamp > $1 AND timestamp < $2 AND country_code IS NOT NULL " +
                      "GROUP BY country_code;";
var server = new Hapi.Server({
  cache: require("catbox-memory")
});

server.connection({
  port: config.port
});

server.method("total", function(start_date, end_date, next) {
  pg.connect(config.db_connection_string, function(pool_error, client, pg_done) {
    if (pool_error) {
      return next(Boom.badImplementation("A database pool connection error occurred", pool_error));
    }

    client.query(total_query, [start_date, end_date], function(query_error, result) {
      pg_done();

      if (query_error) {
        return next(Boom.badImplementation("A database query error occurred", query_error));
      }

      next(null, {
        sum: parseFloat(result.rows[0].sum, 10)
      });
    });
  });
}, {
  cache: {
    expiresIn: 5 * 1000,
    generateTimeout: 1 * 1000
  }
});

server.route({
  method: "GET",
  path: "/eoy-2014-total",
  handler: function(request, reply) {
    server.methods.total(config.start_date, config.end_date, reply);
  },
  config: {
    cors: true,
    jsonp: "callback"
  }
});

server.start(function() {
  console.log('Server running at: %s', server.info.uri);
});
