// Config
var Habitat = require("habitat");
Habitat.load();
var env = new Habitat();
var config = env.get("SERVER");

var Hapi = require("hapi");
var pg;
try {
  pg = require("pg").native;
} catch (ignore_error) {
  pg = require("pg");
}

var total_query = "SELECT SUM(amount)::numeric FROM paypal WHERE timestamp > $1 AND timestamp < $2 " +
                   "AND type NOT IN ('Transfer', 'Received Settlement Withdrawal');";
var bycountry_query = "SELECT country_code, sum(amount)::numeric, count(*) FROM paypal " +
                      "WHERE timestamp > $1 AND timestamp < $2 AND country_code IS NOT NULL " +
                      "GROUP BY country_code;";
var server = Hapi.createServer(config.host, config.port, {
  app: {
    connection_string: config.db_connection_string,
    start_date: config.start_date,
    end_date: config.end_date
  },
  cors: true
});

server.route({
  method: "GET",
  path: "/eoy-2014-total",
  handler: function(request, reply) {
    var connection_string = request.server.settings.app.connection_string;
    var start_date = request.server.settings.app.start_date;
    var end_date = request.server.settings.app.end_date;

    pg.connect(connection_string, function(pool_error, client, done) {
      if (pool_error) {
        return reply(Hapi.error.badImplementation("A database pool connection error occurred", pool_error));
      }

      client.query(total_query, [start_date, end_date], function(query_error, result) {
        done();

        if (query_error) {
          return reply(Hapi.error.badImplementation("A database query error occurred", query_error));
        }

        reply({
          sum: parseFloat(result.rows[0].sum, 10)
        });
      });
    });
  },
  config: {
    jsonp: "callback"
  }
});

server.route({
  method: "GET",
  path: "/eoy-2014-bycountry",
  handler: function(request, reply) {
    var connection_string = request.server.settings.app.connection_string;
    var start_date = request.server.settings.app.start_date;
    var end_date = request.server.settings.app.end_date;

    pg.connect(connection_string, function(pool_error, client, done) {
      if (pool_error) {
        return reply(Hapi.error.badImplementation("A database pool connection error occurred", pool_error));
      }

      client.query(bycountry_query, [start_date, end_date], function(query_error, result) {
        done();

        if (query_error) {
          return reply(Hapi.error.badImplementation("A database query error occurred", query_error));
        }

        var data = result.rows.map(function(row) {
          row.sum = parseFloat(row.sum, 10);
          row.count = parseInt(row.count, 10);
          return row;
        });
        reply(data);
      });
    });
  },
  config: {
    jsonp: "callback"
  }
});

server.start(function() {
  console.log('Server running at: %s', server.info.uri);
});
